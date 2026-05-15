/**
 * Baidu Disguised Player
 * Looks like Baidu homepage, but has a hidden music player
 */

// ======== State ========
const BPlayer = {
  audio: null,
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  volume: 0.7,
  currentSong: null,
  widgetOpen: false,
  fmMode: false,
  _fmLoading: false,
  playMode: 'list', // 'list' | 'shuffle' | 'single'
  _shuffleOrder: [],
  _shuffleIndex: 0,
};

// ======== DOM References ========
const $ = (id) => document.getElementById(id);

// ======== Initialize ========
document.addEventListener('DOMContentLoaded', () => {
  BPlayer.audio = $('baiduAudio');
  BPlayer.audio.volume = BPlayer.volume;

  // Search
  $('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });
  $('searchBtn').addEventListener('click', doSearch);

  // Player widget toggle
  $('playerWidget').addEventListener('click', (e) => {
    if (e.target.closest('.mini-player')) return;
    if (e.target.closest('.mini-ctrl-btn')) return;
    if (e.target.closest('.mini-vol-bar')) return;
    toggleWidget();
  });

  // Mini player controls
  $('miniPlayBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
  });
  $('miniNextBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    nextSong();
  });
  $('miniPrevBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    prevSong();
  });

  // FM buttons
  $('miniFmLike').addEventListener('click', (e) => {
    e.stopPropagation();
    likeFmSong();
  });
  $('miniFmTrash').addEventListener('click', (e) => {
    e.stopPropagation();
    trashFmSong();
  });

  // Play mode toggle
  $('miniModeBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    cyclePlayMode();
  });
  $('miniModeText').addEventListener('click', (e) => {
    e.stopPropagation();
    cyclePlayMode();
  });

  // Volume
  $('miniVolBar').addEventListener('click', (e) => {
    e.stopPropagation();
    setMiniVolume(e);
  });

  // Progress bar
  $('miniProgBar').addEventListener('click', (e) => {
    e.stopPropagation();
    seekMini(e);
  });

  // Audio events
  BPlayer.audio.addEventListener('timeupdate', onTimeUpdate);
  BPlayer.audio.addEventListener('ended', onEnded);
  BPlayer.audio.addEventListener('play', onPlay);
  BPlayer.audio.addEventListener('pause', onPause);
  BPlayer.audio.addEventListener('loadedmetadata', onLoadedMeta);
  BPlayer.audio.addEventListener('error', onAudioError);

  // Show search hint after a moment
  setTimeout(() => $('searchHint').classList.add('show'), 2000);

  // Init play mode UI
  updatePlayModeUI();

  // Load default playlists in background
  loadRecommendPlaylists();
});

// ======== Widget Toggle ========
function toggleWidget() {
  BPlayer.widgetOpen = !BPlayer.widgetOpen;
  const mini = $('miniPlayer');
  mini.classList.toggle('open', BPlayer.widgetOpen);
}

// ======== Search (disguised as web search) ========
async function doSearch() {
  const q = $('searchInput').value.trim();
  if (!q) return;

  const results = $('results');
  results.innerHTML = '<div class="mini-loading"><div class="mini-spinner"></div></div>';
  results.classList.add('show');

  // Hide search hint
  $('searchHint').classList.remove('show');

  try {
    const data = await NeteaseAPI.search(q, 20);
    const songs = data?.songs || [];

    if (songs.length === 0) {
      results.innerHTML = '<div style="text-align:center;padding:40px 0;color:#999;font-size:14px;">未找到相关结果，请尝试其他关键词</div>';
      return;
    }

    const songList = songs.map((s, i) => ({
      id: s.id,
      name: s.name || '未知歌曲',
      artist: (s.artists || []).map(a => a.name).join(' / ') || '未知',
      cover: s.album?.picUrl || s.al?.picUrl || '',
      duration: s.duration || s.dt || 0,
    }));

    // Store for playback
    BPlayer.queue = songList;
    onQueueChanged();

    // Render as web search results
    results.innerHTML = '<div style="font-size:12px;color:#999;margin-bottom:8px;">百度为您找到相关结果约 ' + (songs.length * 10) + ' 个</div>' +
      songList.map((s, i) => {
        const artist = s.artist.replace(/ \/ /g, ' / ');
        const isPlaying = BPlayer.currentSong && BPlayer.currentSong.id == s.id;
        return '<div class="result-item ' + (isPlaying ? 'result-playing' : '') + '" data-index="' + i + '" onclick="playSearchResult(' + i + ')">' +
          '<div class="result-title">' + escapeHtml(s.name) + '</div>' +
          '<div class="result-url">' + escapeHtml(artist) + ' - 音乐</div>' +
          '<div class="result-desc">' + escapeHtml(s.name) + ' - ' + escapeHtml(artist) + '。点击试听高品质音乐。</div>' +
          '<div class="result-meta"><span class="result-tag">音乐</span> ' + formatTime(s.duration) + '</div>' +
          '</div>';
      }).join('');
  } catch (e) {
    results.innerHTML = '<div style="text-align:center;padding:40px 0;color:#999;font-size:14px;">搜索失败，请稍后重试</div>';
  }
}

function playSearchResult(index) {
  BPlayer.currentIndex = index;
  playCurrent();
}

// ======== Playback ========

async function playCurrent() {
  const song = BPlayer.queue[BPlayer.currentIndex];
  if (!song) return;

  // Sync shuffle order when song is selected directly (not via next/prev)
  if (BPlayer.playMode === 'shuffle') {
    const idx = BPlayer._shuffleOrder.indexOf(BPlayer.currentIndex);
    if (idx >= 0) {
      BPlayer._shuffleIndex = idx;
    } else {
      generateShuffleOrder();
    }
  }

  // Update UI immediately
  BPlayer.currentSong = song;
  updateMiniUI();
  updateWeatherNowPlaying();
  showMiniPlayer();

  // Get URL using server-side caching (special mode)
  try {
    const source = song.source || 'netease';
    const res = await fetch('/api/special/save-song', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: song.id, source }),
    });
    const data = await res.json();
    let url = null;

    if (data.code === 200 && data.data && data.data.localUrl) {
      url = data.data.localUrl;
    } else {
      // Fallback to normal URL
      const urlData = await NeteaseAPI.getSongUrl(song.id);
      url = Array.isArray(urlData) ? urlData[0]?.url : (urlData?.[0]?.url || '');
    }

    if (!url) {
      setWeatherText('无法播放');
      return;
    }

    BPlayer.audio.src = url;
    BPlayer.audio.load();
  } catch (e) {
    setWeatherText('播放失败');
  }
}

function togglePlay() {
  if (!BPlayer.audio.src) {
    if (BPlayer.queue.length > 0) {
      playCurrent();
    }
    return;
  }

  if (BPlayer.audio.paused) {
    BPlayer.audio.play();
  } else {
    BPlayer.audio.pause();
  }
}

function nextSong() {
  if (BPlayer.queue.length === 0) return;
  // FM mode: if at end, fetch more
  if (BPlayer.fmMode && BPlayer.currentIndex >= BPlayer.queue.length - 1) {
    fmLoadMore();
    return;
  }
  if (BPlayer.playMode === 'shuffle') {
    BPlayer._shuffleIndex++;
    if (BPlayer._shuffleIndex >= BPlayer._shuffleOrder.length) {
      generateShuffleOrder();
      BPlayer._shuffleIndex = 0;
    }
    BPlayer.currentIndex = BPlayer._shuffleOrder[BPlayer._shuffleIndex];
  } else {
    BPlayer.currentIndex = (BPlayer.currentIndex + 1) % BPlayer.queue.length;
  }
  playCurrent();
}

function prevSong() {
  if (BPlayer.queue.length === 0) return;
  if (BPlayer.audio.currentTime > 3) {
    BPlayer.audio.currentTime = 0;
    return;
  }
  if (BPlayer.playMode === 'shuffle' && BPlayer._shuffleOrder.length > 0) {
    BPlayer._shuffleIndex = (BPlayer._shuffleIndex - 1 + BPlayer._shuffleOrder.length) % BPlayer._shuffleOrder.length;
    BPlayer.currentIndex = BPlayer._shuffleOrder[BPlayer._shuffleIndex];
  } else {
    BPlayer.currentIndex = (BPlayer.currentIndex - 1 + BPlayer.queue.length) % BPlayer.queue.length;
  }
  playCurrent();
}

// ======== Audio Events ========

function onTimeUpdate() {
  if (!BPlayer.audio.duration) return;
  const pct = (BPlayer.audio.currentTime / BPlayer.audio.duration) * 100;
  $('miniProgFill').style.width = pct + '%';
  $('miniCurTime').textContent = formatTime(BPlayer.audio.currentTime * 1000);
}

function onEnded() {
  if (BPlayer.fmMode) {
    if (!BPlayer._fmLoading) fmNext();
    return;
  }
  if (BPlayer.playMode === 'single') {
    BPlayer.audio.currentTime = 0;
    BPlayer.audio.play().catch(() => {});
    return;
  }
  nextSong();
}

function onPlay() {
  BPlayer.isPlaying = true;
  $('miniPlayBtn').innerHTML = '&#10074;&#10074;';
  $('weatherDisplay').classList.add('playing');
}

function onPause() {
  BPlayer.isPlaying = false;
  $('miniPlayBtn').innerHTML = '&#9654;';
  $('weatherDisplay').classList.remove('playing');
}

function onLoadedMeta() {
  $('miniTotalTime').textContent = formatTime((BPlayer.audio.duration || 0) * 1000);
  BPlayer.audio.play().then(() => {
    BPlayer.isPlaying = true;
    updateMiniUI();
  }).catch(() => {
    // Autoplay blocked
  });
}

function onAudioError() {
  setWeatherText('播放出错');
  // Try next song automatically
  setTimeout(() => {
    if (BPlayer.queue.length > 0) nextSong();
  }, 2000);
}

// ======== UI Update ========

function updateMiniUI() {
  const song = BPlayer.currentSong;
  if (!song) return;

  $('miniSongName').textContent = song.name;
  $('miniSongArtist').textContent = song.artist;
  if (song.cover) {
    $('miniCover').src = song.cover + '?param=60y60';
  }
  $('miniPlayBtn').innerHTML = BPlayer.isPlaying ? '&#10074;&#10074;' : '&#9654;';

  // Highlight current in results
  document.querySelectorAll('.result-item').forEach((el, i) => {
    el.classList.toggle('result-playing', i === BPlayer.currentIndex);
  });

  // Update playlist highlight
  document.querySelectorAll('.playlist-item').forEach(el => {
    el.classList.toggle('playing', el.dataset.index == BPlayer.currentIndex);
  });
}

function updateWeatherNowPlaying() {
  const song = BPlayer.currentSong;
  if (song) {
    setWeatherText(song.name);
  }
}

function setWeatherText(text) {
  $('weatherTemp').textContent = text;
}

function showMiniPlayer() {
  $('miniEmpty').style.display = 'none';
  $('miniSongInfo').style.display = 'flex';
  $('miniControls').style.display = 'flex';
  $('miniVolume').style.display = 'flex';
  $('miniProgress').style.display = 'flex';
  $('miniModeText').style.display = 'block';
  updatePlayModeUI();

  // Auto-open widget if not open
  if (!BPlayer.widgetOpen) {
    toggleWidget();
  }
}

// ======== Volume ========

function setMiniVolume(e) {
  const bar = $('miniVolBar');
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  BPlayer.volume = pct;
  BPlayer.audio.volume = pct;
  $('miniVolFill').style.width = (pct * 100) + '%';
}

// ======== Progress ========

function seekMini(e) {
  const bar = $('miniProgBar');
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (BPlayer.audio.duration) {
    BPlayer.audio.currentTime = pct * BPlayer.audio.duration;
  }
}

// ======== Playlists (disguised as links) ========

let _cachedPlaylists = null;

async function loadRecommendPlaylists() {
  try {
    const [recommended] = await Promise.all([
      NeteaseAPI.getRecommendedPlaylists(50).catch(() => []),
    ]);
    if (recommended && recommended.length > 0) {
      _cachedPlaylists = shuffleArray(recommended).slice(0, 12);
    }
  } catch (e) {}
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function showPlaylist(type) {
  const overlay = $('playlistOverlay');
  const items = $('playlistItems');
  const title = $('playlistTitle');

  overlay.classList.add('open');
  items.innerHTML = '<div class="mini-loading"><div class="mini-spinner"></div></div>';

  try {
    if (type === 'saved') {
      // Show saved playlists as a list
      title.textContent = '我的收藏';
      const savedPlaylists = await NeteaseAPI.getPlaylists().catch(() => []);
      if (savedPlaylists.length === 0) {
        items.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-size:13px;">暂无收藏歌单，先去主站收藏一些吧</div><div style="text-align:center;padding:8px;"><a onclick="window.open(\'/\',\'_blank\');closePlaylist();" style="color:#4e6ef2;cursor:pointer;font-size:13px;text-decoration:none;">去主站 →</a></div>';
        return;
      }
      items.innerHTML = savedPlaylists.map((p, i) =>
        '<div class="playlist-item" onclick="openSavedPlaylist(\'' + escapeHtml(p.id) + '\',\'' + escapeHtml(p.name) + '\')" style="cursor:pointer;">' +
        '<span class="playlist-item-idx" style="font-size:18px;">📁</span>' +
        '<div class="playlist-item-info">' +
        '<div class="playlist-item-title">' + escapeHtml(p.name) + '</div>' +
        '<div class="playlist-item-artist">' + (p.songCount || 0) + ' 首歌曲</div>' +
        '</div>' +
        '</div>'
      ).join('');
      return;
    }

    // Remote playlists: recommend, top, new
    let playlists = _cachedPlaylists;
    if (type === 'recommend' || !playlists) {
      if (!playlists) {
        try {
          const data = await NeteaseAPI.getRecommendedPlaylists(50);
          playlists = data?.result || data || [];
          if (playlists.length > 0) playlists = shuffleArray(playlists).slice(0, 12);
        } catch (e) {}
      }
    }
    if (type === 'top' && !playlists) {
      try {
        const data = await NeteaseAPI.getTopPlaylists();
        playlists = data?.list || data || [];
      } catch (e) {}
    }

    // Show remote playlists as a list first
    if (playlists && playlists.length > 0) {
      title.textContent = type === 'top' ? '推荐歌单' : '热门歌单';
      items.innerHTML = playlists.map(pl =>
        '<div class="playlist-item" onclick="openRemotePlaylist(' + pl.id + ',\'' + escapeHtml(pl.name || '歌单') + '\')" style="cursor:pointer;">' +
        '<span class="playlist-item-idx" style="font-size:16px;">▶</span>' +
        '<div class="playlist-item-info">' +
        '<div class="playlist-item-title">' + escapeHtml(pl.name || '未知歌单') + '</div>' +
        '<div class="playlist-item-artist">' + (pl.trackCount || '') + ' 首</div>' +
        '</div>' +
        '</div>'
      ).join('');
      return;
    }

    items.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-size:13px;">暂无歌单</div>';

  } catch (e) {
    items.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-size:13px;">加载失败，请稍后重试</div>';
  }
}

/** Open a saved/local playlist by ID and show its songs */
async function openSavedPlaylist(id, name) {
  const items = $('playlistItems');
  const title = $('playlistTitle');
  title.textContent = escapeHtml(name);
  items.innerHTML = '<div class="mini-loading"><div class="mini-spinner"></div></div>';

  try {
    const plData = await NeteaseAPI.getPlaylist(id);
    const tracks = plData?.songs || [];
    if (tracks.length === 0) {
      items.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-size:13px;">歌单为空</div>';
      return;
    }
    const songs = tracks.map((s, i) => ({
      id: s.id,
      name: s.name,
      artist: s.artist || '未知',
      cover: s.cover || '',
      duration: s.duration || 0,
      _origIdx: i,
    }));

    BPlayer.queue = songs;
    BPlayer.currentIndex = -1;
    onQueueChanged();

    items.innerHTML = songs.map((s, i) =>
      '<div class="playlist-item" data-index="' + i + '" onclick="playPlaylistItem(' + i + ')">' +
      '<span class="playlist-item-idx">' + (i + 1) + '</span>' +
      (s.cover ? '<img class="playlist-item-img" src="' + s.cover + '?param=50y50" loading="lazy">' : '') +
      '<div class="playlist-item-info">' +
      '<div class="playlist-item-title">' + escapeHtml(s.name) + '</div>' +
      '<div class="playlist-item-artist">' + escapeHtml(s.artist) + '</div>' +
      '</div>' +
      '<span class="playlist-item-dur">' + formatTime(s.duration) + '</span>' +
      '</div>'
    ).join('');
  } catch (e) {
    items.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-size:13px;">加载失败</div>';
  }
}

/** Open a remote playlist by ID and show its songs */
async function openRemotePlaylist(id, name) {
  const items = $('playlistItems');
  const title = $('playlistTitle');
  title.textContent = escapeHtml(name);
  items.innerHTML = '<div class="mini-loading"><div class="mini-spinner"></div></div>';

  try {
    const result = await NeteaseAPI.getPlaylistTracks(id);
    const tracks = result?.tracks || result?.playlist?.tracks || [];
    if (tracks.length === 0) {
      items.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-size:13px;">歌单为空</div>';
      return;
    }
    const songs = tracks.map(s => ({
      id: s.id,
      name: s.name,
      artist: s.ar ? s.ar.map(a => a.name).join(' / ') : '未知',
      cover: s.al ? s.al.picUrl : '',
      duration: s.dt || 0,
    }));

    BPlayer.queue = songs;
    BPlayer.currentIndex = -1;
    onQueueChanged();

    items.innerHTML = songs.map((s, i) =>
      '<div class="playlist-item" data-index="' + i + '" onclick="playPlaylistItem(' + i + ')">' +
      '<span class="playlist-item-idx">' + (i + 1) + '</span>' +
      (s.cover ? '<img class="playlist-item-img" src="' + s.cover + '?param=50y50" loading="lazy">' : '') +
      '<div class="playlist-item-info">' +
      '<div class="playlist-item-title">' + escapeHtml(s.name) + '</div>' +
      '<div class="playlist-item-artist">' + escapeHtml(s.artist) + '</div>' +
      '</div>' +
      '<span class="playlist-item-dur">' + formatTime(s.duration) + '</span>' +
      '</div>'
    ).join('');
  } catch (e) {
    items.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-size:13px;">加载失败</div>';
  }
}

function playPlaylistItem(index) {
  BPlayer.currentIndex = index;
  playCurrent();
  // Close playlist overlay
  closePlaylist();
}

function closePlaylist() {
  const el = $('playlistOverlay');
  if (el) el.classList.remove('open');
}

// ======== FM Mode ========

/** Start FM mode */
async function startFm() {
  closePlaylist();
  BPlayer.fmMode = true;
  BPlayer._fmLoading = false;
  updateFmUI();
  setWeatherText('FM');
  $('searchInput').value = '';

  // Hide search results
  $('results').classList.remove('show');

  try {
    const songs = await NeteaseAPI.getFmSongs();
    if (!songs || songs.length === 0) {
      BPlayer.fmMode = false;
      updateFmUI();
      setWeatherText('无FM');
      return;
    }
    BPlayer.queue = songs;
    BPlayer.currentIndex = 0;
    onQueueChanged();
    playCurrent();
  } catch (e) {
    BPlayer.fmMode = false;
    updateFmUI();
    setWeatherText('FM失败');
  }
}

/** Fetch next batch of FM songs */
async function fmLoadMore() {
  if (BPlayer._fmLoading) return;
  BPlayer._fmLoading = true;
  try {
    const songs = await NeteaseAPI.getFmSongs();
    if (songs && songs.length > 0) {
      BPlayer.queue = songs;
      BPlayer.currentIndex = 0;
      onQueueChanged();
      await playCurrent();
    }
  } catch (e) {
    console.warn('FM load more error:', e);
  }
  BPlayer._fmLoading = false;
}

/** Play next FM song (called from onEnded) */
async function fmNext() {
  if (BPlayer._fmLoading) return;
  BPlayer._fmLoading = true;
  try {
    const songs = await NeteaseAPI.getFmSongs();
    if (songs && songs.length > 0) {
      BPlayer.queue = songs;
      BPlayer.currentIndex = 0;
      onQueueChanged();
      await playCurrent();
    }
  } catch (e) {
    console.warn('FM next error:', e);
  }
  BPlayer._fmLoading = false;
}

/** Like current FM song */
async function likeFmSong() {
  if (!BPlayer.currentSong) return;
  try {
    await NeteaseAPI.likeFmSong(BPlayer.currentSong.id, true);
    $('miniFmLike').style.color = '#1db954';
    setTimeout(() => { $('miniFmLike').style.color = ''; }, 1500);
  } catch (e) {
    console.warn('FM like error:', e);
  }
}

/** Trash current FM song and play next */
async function trashFmSong() {
  if (!BPlayer.currentSong) return;
  try {
    await NeteaseAPI.trashFmSong(BPlayer.currentSong.id);
  } catch (e) {
    console.warn('FM trash error:', e);
  }
  fmNext();
}

/** Update FM controls visibility */
function updateFmUI() {
  const fm = $('miniFm');
  if (fm) fm.style.display = BPlayer.fmMode ? 'flex' : 'none';
}

// ======== Play Mode (List / Shuffle / Single) ========

const PLAY_MODE_ICONS = {
  list: '&#8635;',
  shuffle: '&#8644;',
  single: '&#8634;',
};
const PLAY_MODE_NAMES = {
  list: '列表循环',
  shuffle: '随机播放',
  single: '单曲循环',
};
const PLAY_MODE_ORDER = ['list', 'shuffle', 'single'];

function cyclePlayMode() {
  const idx = PLAY_MODE_ORDER.indexOf(BPlayer.playMode);
  BPlayer.playMode = PLAY_MODE_ORDER[(idx + 1) % PLAY_MODE_ORDER.length];

  if (BPlayer.playMode === 'shuffle') {
    generateShuffleOrder();
  }

  updatePlayModeUI();
}

function generateShuffleOrder() {
  const len = BPlayer.queue.length;
  if (len === 0) { BPlayer._shuffleOrder = []; BPlayer._shuffleIndex = 0; return; }

  // Start with current index first, then shuffle the rest
  const cur = BPlayer.currentIndex >= 0 ? BPlayer.currentIndex : 0;
  const rest = [];
  for (let i = 0; i < len; i++) {
    if (i !== cur) rest.push(i);
  }
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  BPlayer._shuffleOrder = [cur, ...rest];
  BPlayer._shuffleIndex = 0;
}

function updatePlayModeUI() {
  const btn = $('miniModeBtn');
  const text = $('miniModeText');
  if (!btn) return;

  const icon = PLAY_MODE_ICONS[BPlayer.playMode] || '&#8635;';
  const name = PLAY_MODE_NAMES[BPlayer.playMode] || '列表循环';
  btn.innerHTML = icon;
  btn.title = name;
  text.textContent = name;

  // Highlight active mode
  const isActive = BPlayer.playMode !== 'list';
  btn.classList.toggle('active', isActive);
  text.classList.toggle('active', isActive);

  // Show mode text when player is visible
  if (BPlayer.currentSong) {
    text.style.display = 'block';
  }
}

// Generate shuffle order when queue changes
function onQueueChanged() {
  if (BPlayer.playMode === 'shuffle') {
    generateShuffleOrder();
  }
}

// ======== Utilities ========

function formatTime(ms) {
  if (!ms) return '0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
