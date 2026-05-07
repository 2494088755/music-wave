/**
 * Main App Module
 * Manages views, navigation, search, playlists, login
 */

// ======== Global State ========
let currentView = 'home';
let userInfo = null;
let qrCheckTimer = null;
let currentPlaylistId = null;
let searchTimer = null;

/**
 * Escape a string for use in HTML attribute
 */
function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Set up event delegation for track lists
 */
function setupTrackListEvents() {
  document.querySelectorAll('.track-list').forEach(list => {
    if (list.dataset.listenerAttached) return;
    list.dataset.listenerAttached = 'true';
    
    // Single click to play
    list.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.js-add-to-queue');
      if (addBtn) {
        e.stopPropagation();
        const item = addBtn.closest('.track-item');
        if (!item) return;
        
        const id = item.dataset.id;
        const name = item.dataset.name || '未知';
        const artist = item.dataset.artist || '未知';
        const cover = item.dataset.cover || '';
        const duration = parseInt(item.dataset.duration) || 0;
        const source = item.dataset.source || 'netease';
        
        Player.addToQueue([{ id, name, artist, cover, duration, source }]);
        return;
      }
      
      const item = e.target.closest('.track-item');
      if (item) {
        const id = item.dataset.id;
        if (id) playSongFromTrack(id);
      }
    });
    
    list.addEventListener('dblclick', (e) => {
      const item = e.target.closest('.track-item');
      if (!item) return;
      const id = item.dataset.id;
      if (id) playSongFromTrack(id);
    });
  });
}

// ======== Initialize ========
document.addEventListener('DOMContentLoaded', () => {
  // Global error handler to prevent silent failures
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error || e.message);
  });
  
  Player.init();
  
  // Setup navigation
  setupNavigation();
  
  // Setup home page refresh buttons (event delegation)
  document.querySelector('.content-scroll').addEventListener('click', (e) => {
    const btn = e.target.closest('.section-refresh-btn');
    if (btn && btn.dataset.type) {
      refreshPlaylists(btn.dataset.type);
    }
  });
  
  // Load home page
  loadHomeView();
  
  // Load local playlists
  loadLocalPlaylists();
  
  // Check login status
  checkLoginStatus();
});

// ======== Navigation ========
function setupNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      switchView(item.dataset.view);
    });
  });
}

function switchView(view, params) {
  currentView = view;
  
  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navItem) navItem.classList.add('active');
  
  // Hide all views
  document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
  
  // Show target view - convert kebab-case to CamelCase id
  const viewId = 'view' + view.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
  }
  
  // Scroll to top
  document.getElementById('contentScroll').scrollTop = 0;
  
  // View-specific logic
  if (view === 'my-playlists') {
    loadMyPlaylists();
  }
  if (view === 'liked-songs') {
    loadLikedSongsView();
  }
  if (view === 'recent') {
    loadRecentSongsView();
  }
  if (view === 'home') {
    loadLocalPlaylists();
  }
}

// ======== Home View ========
async function loadHomeView() {
  try {
    // Parallel fetch both recommended and toplist
    const [recommended, topData] = await Promise.all([
      NeteaseAPI.getRecommendedPlaylists(50).catch(() => []),
      NeteaseAPI.getTopPlaylists().catch(() => []),
    ]);
    
    const recGrid = document.getElementById('recommendedPlaylists');
    if (recommended && recommended.length > 0) {
      const shuffled = shuffleArray([...recommended]);
      recGrid.innerHTML = shuffled.slice(0, 10).map(pl => createPlaylistCard(pl)).join('');
    } else {
      recGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无推荐</div></div>`;
    }
    
    const topGrid = document.getElementById('topPlaylists');
    if (Array.isArray(topData) && topData.length > 0) {
      topGrid.innerHTML = topData.slice(0, 12).map(pl => createToplistCard(pl)).join('');
    } else {
      topGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-text">暂无排行榜</div></div>`;
    }
    
    // Populate sidebar with recommended playlists
    populateSidebarPlaylists(recommended);
    
  } catch (error) {
    console.error('Home view error:', error);
  }
}

/**
 * Refresh home page playlists
 * @param {string} type - 'recommended' or 'top'
 */
/** Generate skeleton grid cards for loading state */
function skeletonCards(count) {
  return `<div class="skeleton-grid">${Array(count).fill('').map(() => `
    <div class="skeleton-card">
      <div class="skeleton-card-image"></div>
      <div class="skeleton-card-text"></div>
      <div class="skeleton-card-text"></div>
    </div>
  `).join('')}</div>`;
}

/** Generate skeleton track list for loading state */
function skeletonTracks(count) {
  return Array(count).fill('').map(() => `
    <div class="skeleton-track">
      <div class="skeleton-track-index"></div>
      <div class="skeleton-track-cover"></div>
      <div class="skeleton-track-info">
        <div class="skeleton-track-title"></div>
        <div class="skeleton-track-artist"></div>
      </div>
    </div>
  `).join('');
}

async function refreshPlaylists(type) {
  const btns = document.querySelectorAll(`.section-refresh-btn[data-type="${type}"]`);
  btns.forEach(b => b.classList.add('spinning'));
  
  try {
    if (type === 'recommended' || !type) {
      const grid = document.getElementById('recommendedPlaylists');
      grid.innerHTML = skeletonCards(10);
      // Fetch more, then pick a random subset for variety
      const recommended = await NeteaseAPI.getRecommendedPlaylists(50);
      if (recommended && recommended.length > 0) {
        const shuffled = shuffleArray([...recommended]);
        const selected = shuffled.slice(0, 10);
        grid.innerHTML = selected.map(pl => createPlaylistCard(pl)).join('');
      } else {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('disc3',48)}</div><div class="empty-text">暂无推荐</div></div>`;
      }
      populateSidebarPlaylists(recommended);
    }
    
    if (type === 'top' || !type) {
      const grid = document.getElementById('topPlaylists');
      grid.innerHTML = skeletonCards(12);
      const topData = await NeteaseAPI.getTopPlaylists();
      // Top playlists API returns an array directly
      if (Array.isArray(topData) && topData.length > 0) {
        grid.innerHTML = topData.slice(0, 12).map(pl => createToplistCard(pl)).join('');
      } else {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('disc3',48)}</div><div class="empty-text">暂无排行榜</div></div>`;
      }
    }
    
    Player.showToast('✅ 已刷新');
  } catch (error) {
    console.error('Refresh error:', error);
    Player.showToast('⚠️ 刷新失败');
  } finally {
    btns.forEach(b => setTimeout(() => b.classList.remove('spinning'), 600));
  }
}

/** Shuffle array in-place using Fisher-Yates */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function populateSidebarPlaylists(playlists) {
  const container = document.getElementById('sidebarPlaylists');
  if (!playlists || playlists.length === 0) return;
  
  const listHtml = playlists.slice(0, 10).map(pl => `
    <div class="playlist-nav-item" onclick="openPlaylistDetail(${pl.id})">
      <span class="playlist-icon">📋</span>
      <span>${escapeHtml(pl.name)}</span>
    </div>
  `).join('');
  
  container.innerHTML = `
    <div class="nav-section-title" style="padding: 8px 20px 4px;">推荐歌单</div>
    ${listHtml}
  `;
}

function createPlaylistCard(pl) {
  const coverUrl = pl.coverImgUrl || pl.picUrl || '';
  return `
    <div class="card" onclick="openPlaylistDetail(${pl.id})">
      <img class="card-image" loading="lazy"src="${coverUrl}?param=200y200" 
           onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%22100%22 y=%22115%22 text-anchor=%22middle%22 font-size=%2248%22 fill=%22%23727272%22%3E🎵%3C/text%3E%3C/svg%3E'"
           alt="${escapeHtml(pl.name)}">
      <div class="card-title">${escapeHtml(pl.name)}</div>
      <div class="card-subtitle">${pl.trackCount || 0} 首</div>
      <button class="card-play-btn" onclick="event.stopPropagation();openPlaylistDetail(${pl.id})"></button><script>document.write(icon("play",16))</script>
          </button>
    </div>
  `;
}

function createToplistCard(pl) {
  const coverUrl = pl.coverImgUrl || pl.coverImageUrl || '';
  return `
    <div class="card" onclick="openPlaylistDetail(${pl.id})">
      <img class="card-image" loading="lazy"src="${coverUrl}?param=200y200" 
           onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%22100%22 y=%22115%22 text-anchor=%22middle%22 font-size=%2248%22 fill=%22%23727272%22%3E🏆%3C/text%3E%3C/svg%3E'"
           alt="${escapeHtml(pl.name)}">
      <div class="card-title">${escapeHtml(pl.name)}</div>
      <div class="card-subtitle">${pl.updateFrequency || '排行榜'}</div>
      <button class="card-play-btn" onclick="event.stopPropagation();openPlaylistDetail(${pl.id})"></button><script>document.write(icon("play",16))</script>
          </button>
    </div>
  `;
}

// ======== Search ========
async function searchSongs(immediate) {
  // Debounce: wait 300ms after last call before actually searching
  clearTimeout(searchTimer);
  
  if (immediate) {
    return doSearch();
  }
  
  searchTimer = setTimeout(doSearch, 300);
  
  async function doSearch() {
  const input = document.getElementById('searchInput');
  const keywords = input.value.trim();
  
  if (!keywords) {
    showSearchHistory();
    return;
  }
  
  // Save to search history
  saveSearchHistory(keywords);
  
  document.getElementById('searchResults').innerHTML = `
    <div class="loading-spinner"><div class="spinner"></div></div>
  `;
  
  const source = document.getElementById('sourceSelector').value;
  
  try {
    const data = await NeteaseAPI.multiSearch(source, keywords);
    const songs = data.songs || [];
    
    if (songs.length === 0) {
      document.getElementById('searchResults').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">😕</div>
          <div class="empty-text">未找到相关结果</div>
        </div>
      `;
      return;
    }
    
    // Render with source indicator
    renderTrackList(songs, 'searchResults', null, source);
  } catch (error) {
    document.getElementById('searchResults').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">搜索失败: ${error.message}</div>
      </div>
    `;
  }
  }
}

function onSourceChange() {
  const input = document.getElementById('searchInput');
  if (input.value.trim()) {
    searchSongs();
  }
}

function renderTrackList(songs, containerId, header, currentSource) {
  const container = document.getElementById(containerId);
  
  let html = '';
  if (header) {
    html += `<div class="section-title">${escapeHtml(header)}</div>`;
  }
  
  const sourceLabel = currentSource ?
    (currentSource === 'gequbao' ? '🎵 歌曲宝' : '☁️ 网易云音乐') : '';
  
  html += `<div class="track-list" data-tracklist="true" data-source="${currentSource || 'netease'}">`;
  
  if (sourceLabel) {
    html += `<div class="track-list-header" style="padding:8px 12px;font-size:12px;color:var(--text-tertiary);border-bottom:1px solid var(--border-color);margin-bottom:4px;">${sourceLabel}</div>`;
  }
  
  songs.forEach((song, index) => {
    // Handle multiple source formats
    const id = song.id || song._hash || '';
    const name = song.name || '未知歌曲';
    const artists = song.artists || song.ar || [];
    const artist = (artists.length > 0 ? artists.map(a => a.name).join(' / ') : '') || song.artist || song.singer || song.singername || '未知';
    const albumName = song.album || (song.al ? song.al.name : (song.album_name || ''));
    const cover = (song.al ? song.al.picUrl : '') || song.cover || song.picUrl || (song.album_img || '');
    const duration = song.duration || song.dt || (song.timelen || 0);
    const isPlaying = Player.currentSong && Player.currentSong.id == id;
    const source = currentSource || 'netease';
    
    html += `
      <div class="track-item ${isPlaying ? 'playing' : ''}" data-id="${escapeAttr(id)}" data-name="${escapeAttr(name)}" data-artist="${escapeAttr(artist)}" data-cover="${escapeAttr(cover)}" data-duration="${duration}" data-source="${source}">
        <span class="track-index">${index + 1}</span>
        ${cover ? `<img class="track-cover" src="${cover}?param=40y40" onerror="this.style.display='none'">` : ''}
        <div class="track-info">
          <div class="track-title">${escapeHtml(name)}</div>
          <div class="track-artist">${escapeHtml(artist)}</div>
        </div>
        <span class="track-album">${escapeHtml(albumName)}</span>
        <div class="track-actions">
          <button class="track-action-btn js-like-track" title="收藏" onclick="event.stopPropagation();Player.toggleLikeById('${escapeAttr(id)}', '${escapeAttr(name)}', '${escapeAttr(artist)}', '${escapeAttr(cover)}', ${duration})">${icon('heart',13)}</button>
          <button class="track-action-btn js-add-to-queue" title="添加到播放列表">${icon('plus',14)}</button>
        </div>
        <span class="track-duration">${formatDuration(duration)}</span>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
  
  // Set up event delegation for track items
  setupTrackListEvents();
}

function playSongFromTrack(id) {
  // Only get tracks from the active/visible content view
  const activeView = document.querySelector('.content-view.active');
  const trackList = activeView ? activeView.querySelectorAll('.track-item') : [];
  const songs = [];
  const source = activeView?.querySelector('.track-list')?.dataset?.source || 'netease';
  
  trackList.forEach(item => {
    const songId = item.dataset.id;
    if (songId) {
      songs.push({
        id: songId,
        name: item.dataset.name || '未知',
        artist: item.dataset.artist || '未知',
        cover: item.dataset.cover || '',
        duration: parseInt(item.dataset.duration) || 0,
        source: item.dataset.source || source,
      });
    }
  });
  
  Player.playById(id, songs);
}

// ======== Playlist Detail ========
async function openPlaylistDetail(playlistId) {
  currentPlaylistId = playlistId;
  switchView('playlist-detail');
  
  const container = document.getElementById('playlistDetailContent');
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
  
  try {
    // Use tracks endpoint which fetches all songs
    const result = await NeteaseAPI.getPlaylistTracks(playlistId);
    const playlist = result;
    const tracks = playlist.tracks || [];
    
    // Build header
    const coverUrl = playlist.coverImgUrl || '';
    const name = playlist.name || '未知歌单';
    const desc = playlist.description || '';
    const creator = playlist.creator ? playlist.creator.nickname : '未知';
    const trackCount = playlist.trackCount || tracks.length;
    const playCount = playlist.playCount || 0;
    
    let html = `
      <div class="playlist-detail-header">
        <img class="playlist-detail-cover" src="${coverUrl}?param=300y300" 
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22300%22%3E%3Crect fill=%22%23282828%22 width=%22300%22 height=%22300%22/%3E%3Ctext x=%22150%22 y=%22165%22 text-anchor=%22middle%22 font-size=%2264%22 fill=%22%23727272%22%3E🎵%3C/text%3E%3C/svg%3E'"
             alt="${escapeHtml(name)}">
        <div class="playlist-detail-info">
          <div class="playlist-detail-type">📋 歌单</div>
          <div class="playlist-detail-name">${escapeHtml(name)}</div>
          ${desc ? `<div class="playlist-detail-desc">${escapeHtml(desc)}</div>` : ''}
          <div class="playlist-detail-meta">
            ${escapeHtml(creator)} · ${trackCount} 首 · ${formatPlayCount(playCount)} 次播放
          </div>
          <div class="playlist-detail-actions">
            <button class="play-all-btn" onclick="playAllPlaylistFromTracks(${playlistId})">${icon('play',16)} 播放全部</button>
          </div>
        </div>
      </div>
    `;
    
    // Render tracks with search
    html += `<div class="section-title" style="display:flex;align-items:center;justify-content:space-between;">
      <span>歌曲列表 (${tracks.length} 首)</span>
      <input class="playlist-search-input" id="playlistSearchInput" type="text" placeholder="在歌单中搜索..." oninput="filterPlaylistTracks(this.value)">
    </div>`;
    container.innerHTML = html;
    
    const trackHtmlContainer = document.createElement('div');
    trackHtmlContainer.id = 'playlistTrackList';
    trackHtmlContainer.dataset.tracks = JSON.stringify(tracks);
    container.appendChild(trackHtmlContainer);
    
    renderTrackList(tracks, 'playlistTrackList');
    
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">加载歌单失败: ${error.message}</div>
      </div>
    `;
  }
}

function filterPlaylistTracks(query) {
  const container = document.getElementById('playlistTrackList');
  if (!container) return;
  const tracks = JSON.parse(container.dataset.tracks || '[]');
  const q = query.trim().toLowerCase();
  if (!q) {
    renderTrackList(tracks, 'playlistTrackList');
    return;
  }
  const filtered = tracks.filter(s => {
    const name = ((s.name || '') + ' ' + ((s.artists || s.ar || []).map(a => a.name).join(' '))).toLowerCase();
    return name.includes(q);
  });
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-text">未找到匹配歌曲</div></div>`;
  } else {
    renderTrackList(filtered, 'playlistTrackList');
  }
}

/**
 * Play all tracks from a playlist
 * @param {string} playlistId - NetEase playlist ID or array of songs
 * @param {boolean} useTracksApi - If true, fetch tracks via getPlaylistTracks API
 */
async function playAllPlaylist(playlistId, useTracksApi) {
  try {
    let tracks;
    if (useTracksApi) {
      const result = await NeteaseAPI.getPlaylistTracks(playlistId);
      tracks = result.tracks || [];
    } else {
      const playlist = await NeteaseAPI.getPlaylist(playlistId);
      tracks = playlist.tracks || [];
    }
    
    if (tracks.length === 0) {
      Player.showToast('⚠️ 该歌单暂无歌曲');
      return;
    }
    
    const songList = tracks.map(s => ({
      id: s.id,
      name: s.name,
      artist: s.ar ? s.ar.map(a => a.name).join(' / ') : '未知',
      cover: s.al ? s.al.picUrl : '',
      duration: s.dt || 0,
    }));
    
    Player.queue = songList;
    Player.currentIndex = 0;
    Player.playById(songList[0].id, songList);
    
  } catch (error) {
    console.error('Play all error:', error);
    Player.showToast('⚠️ 播放失败');
  }
}

function playAllPlaylistFromTracks(playlistId) {
  playAllPlaylist(playlistId, true);
}

function formatPlayCount(count) {
  if (!count) return '0';
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万';
  }
  return count.toString();
}

// ======== My Playlists (Requires Login) ========
async function loadMyPlaylists() {
  const grid = document.getElementById('myPlaylistsGrid');
  
  if (!userInfo) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <div class="empty-text">请先登录网易云音乐</div>
        <button class="login-btn" onclick="openLoginModal()" style="margin-top:16px;">登录</button>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
  
  try {
    const playlists = await NeteaseAPI.getUserPlaylists(userInfo.userId);
    
    if (!playlists || playlists.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无歌单</div></div>`;
      return;
    }
    
    grid.innerHTML = playlists.map(pl => createPlaylistCard(pl)).join('');
  } catch (error) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">加载歌单失败: ${error.message}</div>
      </div>
    `;
  }
}

// ======== Login ========
async function checkLoginStatus() {
  try {
    const result = await NeteaseAPI.getLoginStatus();
    if (result.loggedIn && result.userInfo) {
      userInfo = result.userInfo;
      updateUserButton();
      setTimeout(() => Player.showToast(`👋 欢迎回来，${userInfo.nickname || '用户'}`), 2000);
    }
  } catch (error) {
    console.log('Not logged in');
  }
}

function openLoginModal() {
  document.getElementById('loginModal').classList.add('open');
  initQRLogin();
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.remove('open');
  if (qrCheckTimer) {
    clearInterval(qrCheckTimer);
    qrCheckTimer = null;
  }
}

async function initQRLogin() {
  const qrImage = document.getElementById('qrImage');
  const qrStatus = document.getElementById('qrStatus');
  
  qrStatus.textContent = '正在获取二维码...';
  qrImage.style.display = 'block';
  
  try {
    const data = await NeteaseAPI.getLoginQR();
    qrImage.src = data.qrimg;
    qrStatus.textContent = '请使用网易云音乐扫码登录';
    
    // Start polling
    if (qrCheckTimer) clearInterval(qrCheckTimer);
    qrCheckTimer = setInterval(() => checkQR(data.unikey), 2000);
  } catch (error) {
    qrStatus.textContent = '获取二维码失败，请重试';
    qrImage.style.display = 'none';
  }
}

async function checkQR(key) {
  try {
    const result = await NeteaseAPI.checkQRLogin(key);
    const code = result.data.code;
    
    const qrStatus = document.getElementById('qrStatus');
    
    if (code === 803) {
      // Login successful
      qrStatus.textContent = '✅ 登录成功！';
      if (qrCheckTimer) {
        clearInterval(qrCheckTimer);
        qrCheckTimer = null;
      }
      
      // Reload user info
      const status = await NeteaseAPI.getLoginStatus();
      if (status.loggedIn && status.userInfo) {
        userInfo = status.userInfo;
        updateUserButton();
      }
      
      setTimeout(() => {
        closeLoginModal();
        Player.showToast('✅ 登录成功！');
      }, 1000);
      
    } else if (code === 802) {
      qrStatus.textContent = '📱 已扫码，请在手机上确认';
    } else if (code === 801) {
      qrStatus.textContent = '📱 等待扫码...';
    } else if (code === 800) {
      qrStatus.textContent = '⏰ 二维码已过期，请刷新';
      if (qrCheckTimer) {
        clearInterval(qrCheckTimer);
        qrCheckTimer = null;
      }
    }
  } catch (error) {
    // Silent fail, keep polling
  }
}

function updateUserButton() {
  const userArea = document.getElementById('userArea');
  if (!userArea) return;
  
  userArea.innerHTML = '';
  
  const avatarUrl = userInfo.avatarUrl || '';
  const nickname = userInfo.nickname || '用户';
  
  const btn = document.createElement('div');
  btn.className = 'user-btn';
  btn.style.cursor = 'pointer';
  btn.innerHTML = `
    <img class="user-avatar" src="${avatarUrl}?param=30y30" 
         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2230%22%3E%3Ccircle fill=%22%231db954%22 cx=%2215%22 cy=%2215%22 r=%2215%22/%3E%3Ctext x=%2215%22 y=%2221%22 text-anchor=%22middle%22 font-size=%2216%22 fill=%22white%22%3E${nickname[0]}%3C/text%3E%3C/svg%3E'">
    <span>${escapeHtml(nickname)}</span>
  `;
  
  btn.onclick = async () => {
    if (confirm('退出登录？')) {
      await NeteaseAPI.logout();
      userInfo = null;
      userArea.innerHTML = `<button class="login-btn" onclick="openLoginModal()">登录</button>`;
      Player.showToast('已退出登录');
      if (currentView === 'my-playlists') loadMyPlaylists();
    }
  };
  
  userArea.appendChild(btn);
}

// ======== Global UI Functions (called from HTML) ========
function togglePlay() {
  Player.toggle();
}

function prevSong() {
  Player.prev();
}

function nextSong() {
  Player.next();
}

function toggleShuffle() {
  Player.toggleShuffle();
}

function toggleRepeat() {
  Player.toggleRepeat();
}

function toggleMute() {
  Player.toggleMute();
}

function toggleLyrics() {
  const panel = document.getElementById('lyricsPanel');
  const btn = document.getElementById('lyricsToggle');
  panel.classList.toggle('open');
  btn.classList.toggle('active', panel.classList.contains('open'));
}

function togglePlaylistPanel() {
  const panel = document.getElementById('playlistPanel');
  panel.classList.toggle('open');
}

function seekProgress(event) {
  const bar = document.getElementById('progressBar');
  const rect = bar.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  Player.seekTo(Math.max(0, Math.min(1, percent)));
}

function setVolume(event) {
  const bar = document.getElementById('volumeBar');
  const rect = bar.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  Player.setVolume(Math.max(0, Math.min(1, percent)));
}

// ======== Local Playlist Management ========

/** Load playlists into sidebar and my-playlists view */
async function loadLocalPlaylists() {
  try {
    const playlists = await NeteaseAPI.getPlaylists();
    
    // Update sidebar
    const nav = document.getElementById('localPlaylistsNav');
    if (playlists.length === 0) {
      nav.innerHTML = '<div style="padding:6px 20px;font-size:12px;color:var(--text-tertiary)">暂无收藏歌单</div>';
    } else {
      nav.innerHTML = playlists.map(p => `
        <div class="local-playlist-nav-item" onclick="openLocalPlaylist('${p.id}')">
          🎵 ${escapeHtml(p.name)}
          <span style="margin-left:auto;font-size:11px;color:var(--text-tertiary)">${p.songCount}</span>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Load playlists error:', e);
  }
}

/** Show create playlist modal */
function showCreatePlaylistModal() {
  document.getElementById('createPlaylistModal').classList.add('active');
  document.getElementById('newPlaylistName').value = '';
  document.getElementById('newPlaylistDesc').value = '';
  setTimeout(() => document.getElementById('newPlaylistName').focus(), 100);
}

function closeCreatePlaylistModal() {
  document.getElementById('createPlaylistModal').classList.remove('active');
}

async function confirmCreatePlaylist() {
  const name = document.getElementById('newPlaylistName').value.trim();
  if (!name) {
    Player.showToast('请输入歌单名称');
    return;
  }
  const desc = document.getElementById('newPlaylistDesc').value.trim();
  try {
    await NeteaseAPI.createPlaylist(name, desc);
    Player.showToast('✅ 歌单已创建');
    closeCreatePlaylistModal();
    loadLocalPlaylists();
  } catch (e) {
    Player.showToast('⚠️ 创建失败');
  }
}

/** Show add-to-playlist dialog with current song */
async function showAddToPlaylistDialog() {
  if (!Player.currentSong) {
    Player.showToast('⚠️ 当前没有播放的歌曲');
    return;
  }
  const container = document.getElementById('addToPlaylistList');
  container.innerHTML = '<div style="text-align:center;color:var(--text-tertiary);padding:12px;">加载中...</div>';
  document.getElementById('addToPlaylistModal').classList.add('active');
  
  try {
    const playlists = await NeteaseAPI.getPlaylists();
    const song = Player.currentSong;
    const source = Player.queue[Player.currentIndex]?.source || 'netease';
    
    if (playlists.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-tertiary);padding:12px;">还没有歌单，创建一个吧</div>';
      return;
    }
    
    container.innerHTML = playlists.map(p => `
      <div class="track-item" style="cursor:pointer;" onclick="addCurrentSongToPlaylist('${p.id}')">
        <span style="font-size:16px;margin-right:8px;">🎵</span>
        <div class="track-info">
          <div class="track-title">${escapeHtml(p.name)}</div>
          <div class="track-artist">${p.songCount} 首歌曲</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-tertiary);padding:12px;">加载失败</div>';
  }
}

function closeAddToPlaylistModal() {
  document.getElementById('addToPlaylistModal').classList.remove('active');
}

async function addCurrentSongToPlaylist(playlistId) {
  const song = Player.currentSong;
  const source = Player.queue[Player.currentIndex]?.source || 'netease';
  const duration = song.duration || 0;
  
  try {
    const result = await NeteaseAPI.addSongToPlaylist(playlistId, {
      id: song.id,
      name: song.name,
      artist: song.artist,
      cover: song.cover || '',
      duration,
      source,
    });
    if (result.code === 200) {
      Player.showToast('✅ 已添加到歌单');
      closeAddToPlaylistModal();
      loadLocalPlaylists();
    } else {
      Player.showToast('⚠️ ' + (result.msg || '添加失败'));
    }
  } catch (e) {
    Player.showToast('⚠️ 添加失败');
  }
}

/** Open a local playlist view */
async function openLocalPlaylist(playlistId) {
  switchView('my-local-playlist');
  const container = document.getElementById('myLocalPlaylistContent');
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  
  try {
    const playlist = await NeteaseAPI.getPlaylist(playlistId);
    renderLocalPlaylistView(playlist);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">加载失败: ${e.message}</div></div>`;
  }
}

function renderLocalPlaylistView(playlist) {
  const container = document.getElementById('myLocalPlaylistContent');
  const tracks = playlist.songs || [];
  
  let html = `
    <div class="playlist-detail-header">
      <div class="playlist-detail-cover" style="width:200px;height:200px;border-radius:8px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:64px;">🎵</div>
      <div class="playlist-detail-info">
        <div class="playlist-detail-type">📋 本地歌单</div>
        <div class="playlist-detail-name">${escapeHtml(playlist.name)}</div>
        ${playlist.description ? `<div class="playlist-detail-desc">${escapeHtml(playlist.description)}</div>` : ''}
        <div class="playlist-detail-meta">${tracks.length} 首歌曲</div>
        <div class="playlist-detail-actions">
          ${tracks.length > 0 ? `<button class="play-all-btn" onclick="playLocalPlaylistAll('${playlist.id}')">${icon('play',16)} 播放全部</button>` : ''}
          <button class="play-all-btn" style="background:var(--bg-tertiary);color:var(--text-secondary);" onclick="deleteLocalPlaylist('${playlist.id}')">${icon('trash2',14)} 删除歌单</button>
        </div>
      </div>
    </div>
    <div class="section-title">歌曲列表 (${tracks.length} 首)</div>
  `;
  
  if (tracks.length === 0) {
    html += '<div class="empty-state"><div class="empty-icon">🎵</div><div class="empty-text">歌单为空，去搜索添加歌曲吧</div></div>';
  } else {
    html += '<div class="track-list" data-tracklist="true">';
    tracks.forEach((song, i) => {
      const isPlaying = Player.currentSong && Player.currentSong.id == song.id;
      html += `
        <div class="track-item ${isPlaying ? 'playing' : ''}" data-id="${escapeAttr(song.id)}" data-name="${escapeAttr(song.name)}" data-artist="${escapeAttr(song.artist)}" data-cover="${escapeAttr(song.cover)}" data-duration="${song.duration || 0}" data-source="${song.source || 'netease'}">
          <span class="track-index">${i + 1}</span>
          ${song.cover ? `<img class="track-cover" src="${song.cover}?param=40y40" onerror="this.style.display='none'">` : ''}
          <div class="track-info">
            <div class="track-title">${escapeHtml(song.name)}</div>
            <div class="track-artist">${escapeHtml(song.artist)}</div>
          </div>
          <div class="track-actions">
            <button class="track-action-btn" onclick="event.stopPropagation();removeSongFromLocalPlaylist('${playlist.id}', '${escapeAttr(song.id)}')" title="从歌单移除">${icon('x',12)}</button>
          </div>
          <span class="track-duration">${formatDuration(song.duration || 0)}</span>
        </div>
      `;
    });
    html += '</div>';
  }
  
  container.innerHTML = html;
  setupTrackListEvents();
}

async function playLocalPlaylistAll(playlistId) {
  try {
    const playlist = await NeteaseAPI.getPlaylist(playlistId);
    const songs = playlist.songs || [];
    if (songs.length === 0) return;
    
    const songList = songs.map(s => ({
      id: s.id,
      name: s.name,
      artist: s.artist,
      cover: s.cover,
      duration: s.duration || 0,
      source: s.source || 'netease',
    }));
    
    Player.queue = songList;
    Player.currentIndex = 0;
    Player.playById(songList[0].id, songList);
  } catch (e) {
    Player.showToast('⚠️ 播放失败');
  }
}

async function removeSongFromLocalPlaylist(playlistId, songId) {
  try {
    const result = await NeteaseAPI.removeSongFromPlaylist(playlistId, songId);
    if (result.code === 200) {
      Player.showToast('✅ 已移除');
      openLocalPlaylist(playlistId); // Refresh view
      loadLocalPlaylists();
    }
  } catch (e) {
    Player.showToast('⚠️ 移除失败');
  }
}

async function deleteLocalPlaylist(playlistId) {
  if (!confirm('确定要删除这个歌单吗？')) return;
  try {
    await NeteaseAPI.deletePlaylist(playlistId);
    Player.showToast('✅ 歌单已删除');
    switchView('home');
    loadLocalPlaylists();
  } catch (e) {
    Player.showToast('⚠️ 删除失败');
  }
}

// ======== Search History ========

function getSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem('music_search_history') || '[]');
  } catch (e) { return []; }
}

function saveSearchHistory(keyword) {
  let history = getSearchHistory();
  // Remove duplicate if exists
  history = history.filter(k => k !== keyword);
  // Add to front
  history.unshift(keyword);
  // Keep max 10
  if (history.length > 10) history = history.slice(0, 10);
  try {
    localStorage.setItem('music_search_history', JSON.stringify(history));
  } catch (e) {}
}

function showSearchHistory() {
  const history = getSearchHistory();
  if (history.length === 0) {
    document.getElementById('searchResults').innerHTML = `
      <div class="empty-state">
        <div class="empty-text">输入关键词搜索歌曲</div>
      </div>
    `;
    return;
  }
  document.getElementById('searchResults').innerHTML = `
    <div style="padding:8px 0;font-size:13px;color:var(--text-tertiary);margin-bottom:8px;">搜索历史</div>
    ${history.map(k => `
      <div class="track-item" style="cursor:pointer;" onclick="document.getElementById('searchInput').value='${escapeAttr(k)}';searchSongs(true)">
        <span style="font-size:14px;color:var(--text-tertiary);margin-right:8px;">⏱</span>
        <div class="track-info">
          <div class="track-title">${escapeHtml(k)}</div>
        </div>
        <button class="track-action-btn" onclick="event.stopPropagation();clearSearchHistoryItem('${escapeAttr(k)}')" title="删除">✕</button>
      </div>
    `).join('')}
    <div style="text-align:center;margin-top:12px;">
      <button onclick="clearAllSearchHistory()" style="font-size:12px;color:var(--text-tertiary);">清除历史</button>
    </div>
  `;
}

function clearSearchHistoryItem(keyword) {
  let history = getSearchHistory();
  history = history.filter(k => k !== keyword);
  localStorage.setItem('music_search_history', JSON.stringify(history));
  showSearchHistory();
}

function clearAllSearchHistory() {
  localStorage.removeItem('music_search_history');
  showSearchHistory();
}

// ======== Fullscreen Now Playing ========

function openFullscreen() {
  if (!Player.currentSong) return;
  const overlay = document.getElementById('fullscreenView');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  updateFullscreenInfo();
}

function closeFullscreen() {
  const overlay = document.getElementById('fullscreenView');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function updateFullscreenInfo() {
  const song = Player.currentSong;
  if (!song) return;
  
  document.getElementById('fullscreenSongName').textContent = song.name || '未知歌曲';
  document.getElementById('fullscreenSongArtist').textContent = song.artist || '';
  
  const coverUrl = song.cover ? song.cover + '?param=300y300' : '';
  const coverImg = document.getElementById('fullscreenCover');
  if (coverUrl) {
    coverImg.src = coverUrl;
    // Set background
    document.getElementById('fullscreenBg').style.backgroundImage = `url(${coverUrl})`;
  }
  
  // Sync play state
  const cd = document.getElementById('fullscreenCd');
  cd.classList.toggle('playing', Player.isPlaying);
  
  // Sync play button
  document.getElementById('fullscreenPlayBtn').innerHTML = Player.isPlaying ? icon('pause', 28) : icon('play', 28);
  
  // Update lyrics in fullscreen
  updateFullscreenLyrics();
  
  // Sync progress
  updateFullscreenProgress();
}

function updateFullscreenProgress() {
  const audio = Player.audio;
  if (!audio || !audio.duration) return;
  const percent = (audio.currentTime / audio.duration) * 100;
  document.getElementById('fullscreenProgressFill').style.width = Math.min(100, percent) + '%';
  document.getElementById('fullscreenCurrentTime').textContent = Player.formatTime(audio.currentTime);
  document.getElementById('fullscreenTotalTime').textContent = Player.formatTime(audio.duration);
}

function updateFullscreenLyrics() {
  const container = document.getElementById('fullscreenLyrics');
  // Clone lyrics from the lyrics panel if visible
  const lyricsPanel = document.querySelector('.lyrics-panel .lyric-line');
  if (lyricsPanel) {
    // Lyrics are already rendered by LyricsManager, just show them
    const lines = document.querySelectorAll('.lyrics-panel .lyric-line');
    if (lines.length > 0) {
      // Sync with fullscreen - copy the existing lyrics panel content
      const parent = document.querySelector('.lyrics-panel');
      if (parent) {
        container.innerHTML = parent.innerHTML;
        container.querySelectorAll('.lyric-line').forEach(el => el.classList.remove('active'));
      }
      return;
    }
  }
  container.innerHTML = '<div class="fullscreen-lyrics-placeholder">🎵 暂无歌词</div>';
}

// Sync fullscreen with player events
const origUpdatePlayerUI = Player.updatePlayerUI;
Player.updatePlayerUI = function() {
  origUpdatePlayerUI.call(this);
  if (document.getElementById('fullscreenView').classList.contains('active')) {
    updateFullscreenInfo();
  }
};

// Also sync timeupdate to fullscreen
const origTimeUpdate = Player.onTimeUpdate;
Player.onTimeUpdate = function() {
  origTimeUpdate.call(this);
  if (document.getElementById('fullscreenView').classList.contains('active')) {
    updateFullscreenProgress();
  }
};

// Also sync play/pause
const origOnPlay = Player.onPlay;
Player.onPlay = function() {
  origOnPlay.call(this);
  if (document.getElementById('fullscreenView').classList.contains('active')) {
    document.getElementById('fullscreenCd').classList.add('playing');
    document.getElementById('fullscreenPlayBtn').innerHTML = icon('pause', 28);
  }
};

const origOnPause = Player.onPause;
Player.onPause = function() {
  origOnPause.call(this);
  if (document.getElementById('fullscreenView').classList.contains('active')) {
    document.getElementById('fullscreenCd').classList.remove('playing');
    document.getElementById('fullscreenPlayBtn').innerHTML = icon('play', 28);
  }
};

// Click progress bar to seek
document.addEventListener('click', function(e) {
  if (e.target.closest('#fullscreenProgressBar')) {
    const bar = document.getElementById('fullscreenProgressBar');
    const rect = bar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    Player.seekTo(percent);
  }
});

// Keyboard shortcut: Escape to close
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && document.getElementById('fullscreenView').classList.contains('active')) {
    closeFullscreen();
  }
});

function loadLikedSongsView() {
  const container = document.getElementById('likedSongsContent');
  const liked = Player.likedSongs || [];
  
  if (liked.length === 0) {
    container.innerHTML = `
      <div class="content-header">
        <h2 class="content-title">❤️ 我喜欢</h2>
      </div>
      <div class="empty-state">
        <div class="empty-icon">${icon('heart',48)}</div>
        <div class="empty-text">还没有收藏的歌曲</div>
        <div class="empty-text" style="font-size:12px;color:var(--text-tertiary);">在歌曲上点击 ♡ 即可收藏</div>
      </div>
    `;
    return;
  }
  
  // Sort by likedAt descending (newest first)
  const sorted = [...liked].sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0));
  
  container.innerHTML = `
    <div class="content-header">
      <h2 class="content-title">❤️ 我喜欢 <span style="font-size:14px;font-weight:400;color:var(--text-tertiary);">${liked.length} 首</span></h2>
    </div>
    <div class="track-list">
      ${sorted.map((s, i) => `
        <div class="track-item" data-id="${escapeAttr(s.id)}" data-name="${escapeAttr(s.name || '')}" data-artist="${escapeAttr(s.artist || '')}" data-cover="${escapeAttr(s.cover || '')}" data-duration="${s.duration || 0}" data-source="netease">
          <span class="track-index">${i + 1}</span>
          ${s.cover ? `<img class="track-cover" src="${s.cover}?param=40y40" onerror="this.style.display='none'">` : ''}
          <div class="track-info">
            <div class="track-title">${escapeHtml(s.name || '未知歌曲')}</div>
            <div class="track-artist">${escapeHtml(s.artist || '未知')}</div>
          </div>
          <div class="track-actions">
            <button class="track-action-btn" onclick="event.stopPropagation();Player.toggleLikeById('${escapeAttr(s.id)}','${escapeAttr(s.name)}','${escapeAttr(s.artist)}','${escapeAttr(s.cover)}',${s.duration || 0});loadLikedSongsView()" title="取消收藏">${icon('heart',13)}</button>
          </div>
          <span class="track-duration">${formatDuration(s.duration)}</span>
        </div>
      `).join('')}
    </div>
  `;
  setupTrackListEvents();
}

// ======== Sleep Timer ========

let sleepTimerId = null;
let sleepTimerEnd = null;

function showSleepTimerMenu() {
  const menu = document.getElementById('sleepTimerMenu');
  menu.classList.toggle('active');
}

function setSleepTimer(minutes) {
  cancelSleepTimer();
  
  if (minutes === -1) {
    Player._stopAfterCurrent = true;
    document.getElementById('sleepTimerBadge').textContent = '1';
    document.getElementById('sleepTimerBadge').style.display = '';
    document.getElementById('sleepTimerCancel').style.display = '';
    Player.showToast('⏰ 当前歌曲结束后停止');
  } else {
    const ms = minutes * 60 * 1000;
    sleepTimerEnd = Date.now() + ms;
    sleepTimerId = setTimeout(() => {
      Player.audio.pause();
      Player.showToast('⏰ 睡眠定时器已停止播放');
      cancelSleepTimer();
    }, ms);
    document.getElementById('sleepTimerBadge').textContent = minutes;
    document.getElementById('sleepTimerBadge').style.display = '';
    document.getElementById('sleepTimerCancel').style.display = '';
    Player.showToast(`⏰ ${minutes} 分钟后停止播放`);
  }
}

function cancelSleepTimer() {
  if (sleepTimerId) { clearTimeout(sleepTimerId); sleepTimerId = null; }
  sleepTimerEnd = null;
  Player._stopAfterCurrent = false;
  document.getElementById('sleepTimerBadge').style.display = 'none';
  document.getElementById('sleepTimerCancel').style.display = 'none';
}

// Hook into song end for "stop after current"
const origOnEnded = Player.onEnded;
Player.onEnded = function() {
  if (this._stopAfterCurrent) {
    this._stopAfterCurrent = false;
    this.isPlaying = false;
    this.updatePlayBtn();
    document.getElementById('sleepTimerBadge').style.display = 'none';
    document.getElementById('sleepTimerCancel').style.display = 'none';
    this.showToast('⏰ 睡眠定时器已停止播放');
    return;
  }
  origOnEnded.call(this);
};

// Escape to close fullscreen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('fullscreenView').classList.contains('active')) {
    closeFullscreen();
  }
});

// Micro-animations: fade-in for dynamic track items
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .track-item { transition: background 0.15s ease, transform 0.15s ease; }
  .track-item:hover { transform: translateX(2px); }
  .playlist-panel-item { transition: all 0.15s ease; }
  .playlist-panel-item:hover { background: var(--bg-hover); }
  .player-cover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
  .player-cover:hover { transform: scale(1.05); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
`;
document.head.appendChild(styleSheet);

// ======== Recent Songs View ========

function loadRecentSongsView() {
  const container = document.getElementById('recentSongsContent');
  const recent = Player.recentSongs || [];
  
  if (recent.length === 0) {
    container.innerHTML = `
      <div class="content-header">
        <h2 class="content-title">🕐 最近播放</h2>
      </div>
      <div class="empty-state">
        <div class="empty-text">还没有播放记录</div>
        <div class="empty-text" style="font-size:12px;color:var(--text-tertiary);">播放歌曲后会自动记录</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="content-header">
      <h2 class="content-title">🕐 最近播放 <span style="font-size:14px;font-weight:400;color:var(--text-tertiary);">${recent.length} 首</span></h2>
    </div>
    <div class="track-list">
      ${recent.map((s, i) => `
        <div class="track-item" data-id="${escapeAttr(s.id)}" data-name="${escapeAttr(s.name || '')}" data-artist="${escapeAttr(s.artist || '')}" data-cover="${escapeAttr(s.cover || '')}" data-duration="${s.duration || 0}" data-source="${s.source || 'netease'}">
          <span class="track-index">${i + 1}</span>
          ${s.cover ? `<img class="track-cover" src="${s.cover}?param=40y40" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="track-info">
            <div class="track-title">${escapeHtml(s.name || '未知歌曲')}</div>
            <div class="track-artist">${escapeHtml(s.artist || '')}</div>
          </div>
          <span class="track-duration">${formatDuration(s.duration)}</span>
        </div>
      `).join('')}
    </div>
  `;
  setupTrackListEvents();
}

// Also show search history on focus
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  if (input) {
    input.addEventListener('focus', () => {
      if (!input.value.trim()) showSearchHistory();
    });
  }
});
