/**
 * Audio Player Module
 * Manages playback, playlist, and player state
 */
const Player = {
  // State
  currentIndex: -1,
  queue: [],
  isPlaying: false,
  volume: 0.7,
  isMuted: false,
  prevVolume: 0.7,
  shuffle: false,
  repeat: 'all', // 'all', 'one', 'none'
  currentSong: null,
  heartMode: false,
  specialMode: false,
  fmMode: false,
  likedSongs: [],
  recentSongs: [],
  _originalQueue: [],
  _originalIndex: -1,
  
  // DOM refs
  audio: null,
  
  /**
   * Initialize the player
   */
  init() {
    this.audio = document.getElementById('audioPlayer');
    
    // Audio event listeners
    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
    this.audio.addEventListener('error', () => this.onError());
    this.audio.addEventListener('play', () => this.onPlay());
    this.audio.addEventListener('pause', () => this.onPause());
    
    // Progress bar hover time preview
    const progressBar = document.getElementById('progressBar');
    progressBar.addEventListener('mousemove', (e) => this.onProgressHover(e));
    progressBar.addEventListener('mouseleave', () => this.onProgressLeave());
    
    // Set initial volume
    this.audio.volume = this.volume;
    
    // Set initial button titles
    document.getElementById('repeatBtn').title = '列表循环';
    document.getElementById('shuffleBtn').title = '随机播放';
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.toggle();
      }
      if (e.code === 'ArrowLeft') this.seek(-5);
      if (e.code === 'ArrowRight') this.seek(5);
      if (e.code === 'ArrowUp') { e.preventDefault(); this.adjustVolume(0.05); }
      if (e.code === 'ArrowDown') { e.preventDefault(); this.adjustVolume(-0.05); }
    });

    // Restore saved queue on init
    this.restoreQueue();
    this.loadLikedSongs();
    this.loadRecentSongs();

    // Init audio visualizer after a click (AudioContext requires user gesture)
    document.addEventListener('click', () => {
      if (!this._audioCtx) {
        this.initVisualizer();
      }
      this.resizeVisualizer();
    }, { once: true });
    
    // Virtual scroll: re-render playlist on scroll
    const panelList = document.getElementById('playlistPanelList');
    panelList.addEventListener('scroll', () => {
      if (this.queue.length > 60) this.updatePlaylistUI();
    }, { passive: true });
    window.addEventListener('resize', () => this.resizeVisualizer());
  },

  /**
   * Load and play a song by its ID — supports multi-source
   * Refactored into focused sub-methods for clarity
   */
  async playById(songId, songsList) {
    try {
      this.setupQueue(songId, songsList);
      if (!this.queue[this.currentIndex]) return;

      // Special mode: clear old server cache before playing new song
      if (this.specialMode) {
        try { await fetch('/api/special/clear', { method: 'POST' }); } catch (e) {}
      }

      // 1. Show immediate UI with available info
      this.showSongPlaceholder(songId);

      // 2. Get playable URL (with fallback chain)
      let audioUrl;
      if (this.specialMode) {
        // Special mode: download to server first, then play from local
        audioUrl = await this.specialSaveAndGetUrl(songId);
      } else {
        const result = await this.resolveAudioUrl(songId);
        audioUrl = result ? result.audioUrl : null;
      }

      if (!audioUrl) {
        this.showToast('⚠️ 该歌曲暂无播放源');
        return;
      }

      // 3. Start playback
      this.audio.src = audioUrl;
      this.audio.load();

      // 4. Fetch metadata + lyrics (non-blocking)
      const queueSong = this.queue[this.currentIndex] || {};
      if (queueSong.source === 'netease' || !queueSong.source) {
        this.fetchSongMetadata(songId).catch(() => {});
        this.fetchSimilarSongs(songId);
      }

      // 5. Update UI
      this.updatePlaylistUI();
      this.updateTrackHighlight();

    } catch (error) {
      console.error('Play error:', error);
      this.showToast('⚠️ 播放失败: ' + error.message);
    }
  },

  /**
   * Set up queue from song list, find current song index
   */
  setupQueue(songId, songsList) {
    if (songsList && songsList.length > 0) {
      const idx = songsList.findIndex(s => s.id === songId || s.id == songId);
      if (idx >= 0) {
        this.queue = songsList;
        this.currentIndex = idx;
      }
    }
  },

  /**
   * Set initial UI immediately without waiting for API
   */
  showSongPlaceholder(songId) {
    const queueSong = this.queue[this.currentIndex] || {};
    this.currentSong = {
      id: songId,
      name: queueSong.name || '加载中...',
      artist: queueSong.artist || '',
      album: queueSong.album || '',
      cover: queueSong.cover || '',
      duration: queueSong.duration || 0,
    };
    this.updatePlayerUI();
    this.updateLikeBtn();
    this.recordRecent(this.currentSong);
  },

  /**
   * Get audio URL from appropriate source with fallbacks
   * @returns {Promise<{source:string, audioUrl:string}>}
   */
  async resolveAudioUrl(songId) {
    const queueSong = this.queue[this.currentIndex] || {};
    let source = queueSong.source || 'netease';
    let audioUrl = '';

    switch (source) {
      case 'gequbao':
        audioUrl = await this.fetchGequbaoUrl(songId);
        break;
      default:
        audioUrl = await this.fetchNeteaseUrl(songId);
    }

    return { source, audioUrl };
  },

  /**
   * Special environment mode: save song to server then get local URL
   */
  async specialSaveAndGetUrl(songId) {
    try {
      const queueSong = this.queue[this.currentIndex] || {};
      const source = queueSong.source || 'netease';
      
      const res = await fetch('/api/special/save-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: songId, source }),
      });
      const data = await res.json();
      
      if (data.code !== 200 || !data.data || !data.data.localUrl) {
        console.error('Special save failed:', data);
        return null;
      }
      
      return data.data.localUrl;
    } catch (error) {
      console.error('Special save error:', error);
      return null;
    }
  },

  /**
   * Get KuGou song URL with NetEase fallback
   */
  /**
   * Get 歌曲宝 song URL with metadata update
   */
  async fetchGequbaoUrl(songId) {
    try {
      const urlData = await NeteaseAPI.multiGetUrl('gequbao', songId);
      if (urlData?.url) {
        if (urlData.title) {
          this.currentSong.name = urlData.title;
          this.currentSong.artist = urlData.author || this.currentSong.artist;
          this.currentSong.cover = urlData.cover || this.currentSong.cover;
          this.updatePlayerUI();
          if (this.queue[this.currentIndex]) {
            this.queue[this.currentIndex].name = urlData.title;
            this.queue[this.currentIndex].artist = urlData.author || this.currentSong.artist;
          }
        }
        return urlData.url;
      }
    } catch(e) {
      console.log('Gequbao URL error:', e.message);
    }
    return '';
  },

  /**
   * Get NetEase song URL
   */
  async fetchNeteaseUrl(songId) {
    try {
      const urlData = await NeteaseAPI.getSongUrl(songId);
      if (Array.isArray(urlData)) {
        return urlData[0]?.url || '';
      }
      if (urlData[0]) {
        return urlData[0]?.url || '';
      }
    } catch(e) {
      console.log('NetEase URL error:', e.message);
    }
    return '';
  },

  /**
   * Fetch song detail + lyrics (NetEase only)
   */
  async fetchSongMetadata(songId) {
    const [detailData] = await Promise.all([
      NeteaseAPI.getSongDetail(songId).catch(() => ({ songs: [] })),
      this.fetchLyrics(songId).catch(() => {}),
    ]);

    if (detailData?.songs?.[0]) {
      const s = detailData.songs[0];
      this.currentSong = {
        id: songId,
        name: s.name || this.currentSong.name,
        artist: s.ar ? s.ar.map(a => a.name).join(' / ') : this.currentSong.artist,
        album: s.al ? s.al.name : this.currentSong.album,
        cover: s.al ? s.al.picUrl : this.currentSong.cover,
        duration: s.dt || this.currentSong.duration,
      };
      this.updatePlayerUI();
    }
  },

  /**
   * Fetch and display similar songs (NetEase only)
   */
  async fetchSimilarSongs(songId) {
    try {
      const songs = await NeteaseAPI.getSimilarSongs(songId);
      if (!songs || songs.length === 0) return;
      
      // Map to unified format
      const songList = songs.map(s => ({
        id: s.id,
        name: s.name,
        artist: (s.artists || []).map(a => a.name).join(' / '),
        cover: s.album?.picUrl || s.al?.picUrl || '',
        duration: s.duration || 0,
        source: 'netease',
      }));
      
      // Show similar songs in a collapsible section below current content
      const container = document.getElementById('searchResults');
      const existing = container.querySelector('.similar-songs-section');
      if (existing) existing.remove();
      
      const section = document.createElement('div');
      section.className = 'similar-songs-section';
      section.innerHTML = `
        <div class="section-title" style="margin-top:24px;">🎵 相似歌曲</div>
        <div class="track-list">
          ${songList.map((s, i) => `
            <div class="track-item" data-id="${s.id}" data-name="${escapeAttr(s.name)}" data-artist="${escapeAttr(s.artist)}" data-cover="${escapeAttr(s.cover)}" data-duration="${s.duration}" data-source="netease">
              <span class="track-index">${i + 1}</span>
              ${s.cover ? `<img class="track-cover" src="${s.cover}?param=40y40" onerror="this.style.display='none'">` : ''}
              <div class="track-info">
                <div class="track-title">${escapeHtml(s.name)}</div>
                <div class="track-artist">${escapeHtml(s.artist)}</div>
              </div>
              <span class="track-duration">${formatDuration(s.duration)}</span>
            </div>
          `).join('')}
        </div>
      `;
      container.appendChild(section);
      setupTrackListEvents();
    } catch (e) {
      console.log('Similar songs error:', e.message);
    }
  },

  /**
   * Fetch and display lyrics
   */
  async fetchLyrics(songId) {
    try {
      const data = await NeteaseAPI.getLyric(songId);
      let lrcText = '';
      
      if (data.lrc && data.lrc.lyric) {
        lrcText = data.lrc.lyric;
      } else if (data.klyric && data.klyric.lyric) {
        lrcText = data.klyric.lyric;
      } else if (data.tlyric && data.tlyric.lyric) {
        lrcText = data.tlyric.lyric;
      }
      
      if (lrcText) {
        const parsed = LyricsManager.parse(lrcText);
        LyricsManager.render(parsed);
      } else {
        LyricsManager.render([]);
      }
    } catch (error) {
      console.error('Lyric fetch error:', error);
      LyricsManager.render([]);
    }
  },

  /**
   * Toggle play/pause
   */
  toggle() {
    if (!this.audio.src) {
      if (this.queue.length > 0) {
        this.playById(this.queue[0].id, this.queue);
      }
      return;
    }
    
    if (this.audio.paused) {
      this.audio.play();
    } else {
      this.audio.pause();
    }
  },

  /**
   * Play next song with crossfade
   */
  async next() {
    if (this.queue.length === 0) return;
    
    // In heart mode, queue next batch of similar songs before transitioning
    const currentId = this.currentSong?.id;
    if (this.heartMode && currentId) {
      this.queueSimilarSongs(currentId);
    }
    this.fadeOut(() => {
      let nextIndex;
      if (this.shuffle) {
        nextIndex = this.getRandomIndex();
      } else if (this.repeat === 'one') {
        nextIndex = this.currentIndex;
      } else {
        nextIndex = (this.currentIndex + 1) % this.queue.length;
      }
      this.currentIndex = nextIndex;
      const song = this.queue[nextIndex];
      this.playById(song.id, this.queue);
    });
  },

  /**
   * Fade out over 500ms then callback
   */
  fadeOut(callback) {
    const vol = this.audio.volume;
    if (vol <= 0) { if (callback) callback(); return; }
    const totalSteps = 10;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      this.audio.volume = Math.max(0, vol * (1 - i / totalSteps));
      if (i >= totalSteps) {
        clearInterval(interval);
        if (callback) callback();
      }
    }, 50);
  },

  /**
   * Fade in over 300ms
   */
  fadeIn(targetVolume) {
    const vol = targetVolume || this.volume;
    this.audio.volume = 0;
    const totalSteps = 10;
    let i = 0;
    this.audio.volume = 0;
    const interval = setInterval(() => {
      i++;
      this.audio.volume = Math.min(vol, vol * (i / totalSteps));
      if (i >= totalSteps) {
        clearInterval(interval);
        this.audio.volume = vol;
      }
    }, 30);
  },

  /**
   * Play previous song
   */
  async prev() {
    if (this.queue.length === 0) return;
    
    // If more than 3 seconds into the song, restart
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    
    let prevIndex;
    if (this.shuffle) {
      prevIndex = this.getRandomIndex();
    } else {
      prevIndex = (this.currentIndex - 1 + this.queue.length) % this.queue.length;
    }
    
    this.currentIndex = prevIndex;
    const song = this.queue[prevIndex];
    this.playById(song.id, this.queue);
  },

  /**
   * Get random index (different from current)
   */
  getRandomIndex() {
    if (this.queue.length <= 1) return 0;
    let idx;
    do {
      idx = Math.floor(Math.random() * this.queue.length);
    } while (idx === this.currentIndex);
    return idx;
  },

  /**
   * Seek to a position
   */
  seek(seconds) {
    if (!this.audio.src) return;
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, this.audio.currentTime + seconds));
  },

  /**
   * Seek to a percentage (0-1)
   */
  seekTo(percent) {
    if (!this.audio.src || !this.audio.duration) return;
    this.audio.currentTime = percent * this.audio.duration;
  },

  onProgressHover(e) {
    const bar = document.getElementById('progressBar');
    const rect = bar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const hoverTime = document.getElementById('progressHoverTime');
    const duration = this.audio.duration || 0;
    const time = percent * duration;
    hoverTime.textContent = this.formatTime(time);
    hoverTime.style.left = `${Math.max(2, Math.min(98, percent * 100))}%`;
  },

  onProgressLeave() {
    // hover state is managed by CSS opacity, no extra logic needed
  },

  /**
   * Adjust volume
   */
  adjustVolume(delta) {
    this.volume = Math.max(0, Math.min(1, this.volume + delta));
    this.audio.volume = this.volume;
    this.isMuted = this.volume === 0;
    this.updateVolumeUI();
  },

  /**
   * Set volume to a percentage (0-1)
   */
  setVolume(percent) {
    this.volume = Math.max(0, Math.min(1, percent));
    this.audio.volume = this.volume;
    this.isMuted = this.volume === 0;
    this.updateVolumeUI();
  },

  /**
   * Toggle mute
   */
  toggleMute() {
    if (this.isMuted) {
      this.volume = this.prevVolume || 0.7;
      this.isMuted = false;
    } else {
      this.prevVolume = this.volume;
      this.volume = 0;
      this.isMuted = true;
    }
    this.audio.volume = this.volume;
    this.updateVolumeUI();
  },

  /**
   * Toggle shuffle
   */
  toggleShuffle() {
    this.shuffle = !this.shuffle;
    const btn = document.getElementById('shuffleBtn');
    btn.innerHTML = icon('shuffle', 18);
    btn.classList.toggle('active', this.shuffle);
    this.showToast(this.shuffle ? '🔀 随机播放已开启' : '🔀 顺序播放');
  },

  /**
   * Toggle repeat mode — optimized with better UX
   */
  toggleRepeat() {
    const modes = ['all', 'one', 'none'];
    const currentIdx = modes.indexOf(this.repeat);
    this.repeat = modes[(currentIdx + 1) % modes.length];
    
    const btn = document.getElementById('repeatBtn');
    btn.classList.remove('active');
    btn.style.opacity = '';
    
    if (this.repeat === 'one') {
      btn.innerHTML = icon('repeat1', 18);
      btn.classList.add('active');
      btn.title = '单曲循环';
      this.showToast('🔂 单曲循环');
    } else if (this.repeat === 'all') {
      btn.innerHTML = icon('repeat', 18);
      btn.title = '列表循环';
      this.showToast('🔁 列表循环');
    } else {
      btn.innerHTML = icon('repeat', 18);
      btn.style.opacity = '0.4';
      btn.title = '顺序播放（不循环）';
      this.showToast('➡️ 顺序播放（不循环）');
    }
  },

  /**
   * Clear the playlist
   */
  clearPlaylist() {
    this.queue = [];
    this.currentIndex = -1;
    this.currentSong = null;
    this.audio.pause();
    this.audio.src = '';
    this.isPlaying = false;
    this.updatePlaylistUI();
    this.updatePlayerUI();
    this.updatePlayBtn();
    LyricsManager.clear();
  },

  // ======== Like / 心动模式 ========

  /**
   * Load liked songs from localStorage
   */
  loadLikedSongs() {
    try {
      const raw = localStorage.getItem('music_liked_songs');
      this.likedSongs = raw ? JSON.parse(raw) : [];
    } catch (e) { this.likedSongs = []; }
  },

  /**
   * Save liked songs to localStorage
   */
  saveLikedSongs() {
    try {
      localStorage.setItem('music_liked_songs', JSON.stringify(this.likedSongs));
    } catch (e) {}
  },

  // ======== Recent Songs ========

  loadRecentSongs() {
    try {
      const raw = localStorage.getItem('music_recent_songs');
      this.recentSongs = raw ? JSON.parse(raw) : [];
    } catch (e) { this.recentSongs = []; }
  },

  saveRecentSongs() {
    try {
      localStorage.setItem('music_recent_songs', JSON.stringify(this.recentSongs));
    } catch (e) {}
  },

  recordRecent(song) {
    if (!song || !song.id) return;
    this.recentSongs = this.recentSongs.filter(s => s.id != song.id);
    this.recentSongs.unshift({
      id: song.id,
      name: song.name || '未知',
      artist: song.artist || '',
      cover: song.cover || '',
      duration: song.duration || 0,
      source: song.source || 'netease',
      playedAt: Date.now(),
    });
    if (this.recentSongs.length > 50) this.recentSongs = this.recentSongs.slice(0, 50);
    this.saveRecentSongs();
  },

  /**
   * Toggle like for current song
   * Toggle like for current song
   */
  toggleLike() {
    if (!this.currentSong) return;
    const id = this.currentSong.id;
    const idx = this.likedSongs.findIndex(s => s.id === id || s.id == id);
    
    if (idx >= 0) {
      this.likedSongs.splice(idx, 1);
      this.showToast('已取消收藏');
    } else {
      this.likedSongs.push({
        id: id,
        name: this.currentSong.name,
        artist: this.currentSong.artist,
        cover: this.currentSong.cover,
        duration: this.currentSong.duration,
        source: 'netease',
        likedAt: Date.now(),
      });
      this.showToast('❤️ 已收藏');
    }
    
    this.saveLikedSongs();
    this.updateLikeBtn();
  },

  /**
   * Toggle like by song details (used from track list items)
   */
  toggleLikeById(id, name, artist, cover, duration) {
    const idx = this.likedSongs.findIndex(s => s.id === id || s.id == id);
    
    if (idx >= 0) {
      this.likedSongs.splice(idx, 1);
      this.showToast('已取消收藏');
    } else {
      this.likedSongs.push({
        id: id,
        name: name || '未知',
        artist: artist || '',
        cover: cover || '',
        duration: duration || 0,
        source: 'netease',
        likedAt: Date.now(),
      });
      this.showToast('❤️ 已收藏');
    }
    
    this.saveLikedSongs();
    this.updateLikeBtn();
  },

  /**
   * Update like button state
   */
  updateLikeBtn() {
    const btn = document.getElementById('likeBtn');
    if (!this.currentSong) { btn.style.display = 'none'; return; }
    btn.style.display = '';
    
    const id = this.currentSong.id;
    const liked = this.likedSongs.some(s => s.id === id || s.id == id);
    
    if (liked) {
      btn.innerHTML = icon('heart', 16);
      btn.style.color = 'var(--accent-color)';
    } else {
      btn.innerHTML = icon('heart', 16);
      btn.style.color = 'var(--text-tertiary)';
    }
  },

  /**
   * Toggle 心动模式 — replaces queue with similar songs or restores original
   */
  toggleHeartMode() {
    this.heartMode = !this.heartMode;
    const btn = document.getElementById('heartModeBtn');
    
    if (this.heartMode) {
      // Save original queue before replacing
      this._originalQueue = [...this.queue];
      this._originalIndex = this.currentIndex;
      btn.style.color = 'var(--accent-color)';
      
      if (this.currentSong && this.currentSong.id) {
        this.showToast('💓 心动模式已开启，正在生成推荐列表...');
        this.replaceWithSimilar(this.currentSong.id);
      } else {
        this.showToast('💓 心动模式已开启');
      }
    } else {
      // Restore original queue
      btn.style.color = 'var(--text-tertiary)';
      if (this._originalQueue.length > 0) {
        this.queue = [...this._originalQueue];
        this.currentIndex = Math.min(this._originalIndex, this.queue.length - 1);
        this._originalQueue = [];
        this._originalIndex = -1;
        this.updatePlaylistUI();
        if (this.queue.length > 0 && this.queue[this.currentIndex]) {
          this.playById(this.queue[this.currentIndex].id, this.queue);
        }
      }
      this.showToast('💓 心动模式已关闭，已恢复原列表');
    }
  },

  toggleSpecialMode() {
    this.specialMode = !this.specialMode;
    const toggle = document.getElementById('specialModeToggle');
    if (toggle) toggle.checked = this.specialMode;
    this.showToast(this.specialMode ? '📦 特殊环境模式已开启 - 歌曲将缓存到服务器播放' : '📦 特殊环境模式已关闭');
  },

  // ======== Personal FM Mode ========

  async toggleFmMode() {
    if (!this.currentSong && !this.fmMode) {
      // Start FM mode
      this.fmMode = true;
      this.updateFmUI();
      this.showToast('📻 私人FM 启动中...');
      await this.startFmPlayback();
    } else if (this.fmMode) {
      // Turn off FM mode
      this.fmMode = false;
      this.updateFmUI();
      this.showToast('📻 私人FM 已关闭');
    } else {
      // Toggle on
      this.fmMode = true;
      this.updateFmUI();
      this.showToast('📻 私人FM 启动中...');
      await this.startFmPlayback();
    }
  },

  async startFmPlayback() {
    try {
      const songs = await NeteaseAPI.getFmSongs();
      if (!songs || songs.length === 0) {
        this.showToast('⚠️ 暂无FM推荐，请先登录或设置Cookie');
        this.fmMode = false;
        this.updateFmUI();
        return;
      }

      // Set queue to FM songs and start playing
      this.queue = songs;
      this.currentIndex = 0;
      this.showSongPlaceholder(songs[0].id);
      
      // Play with FM handling
      await this.playById(songs[0].id, this.queue);
      this.showToast('📻 私人FM 已开启');
    } catch (error) {
      this.showToast('⚠️ FM启动失败: ' + error.message);
      this.fmMode = false;
      this.updateFmUI();
    }
  },

  async likeCurrentFmSong() {
    if (!this.currentSong) return;
    try {
      await NeteaseAPI.likeFmSong(this.currentSong.id, true);
      const btn = document.getElementById('fmLikeBtn');
      if (btn) btn.style.color = 'var(--accent-color)';
      this.showToast('❤️ 已红心');
    } catch (error) {
      this.showToast('⚠️ 红心失败');
    }
  },

  async trashCurrentFmSong() {
    if (!this.currentSong) return;
    try {
      await NeteaseAPI.trashFmSong(this.currentSong.id);
      this.showToast('🗑️ 已移除，正在播放下一首');
      // Play next FM song
      this.next();
    } catch (error) {
      this.showToast('⚠️ 操作失败');
    }
  },

  updateFmUI() {
    const btn = document.getElementById('fmBtn');
    const fmControls = document.getElementById('fmControls');
    if (btn) btn.style.color = this.fmMode ? '#1db954' : 'var(--text-tertiary)';
    if (fmControls) fmControls.style.display = this.fmMode ? 'inline-flex' : 'none';
    
    // Override repeat mode to 'all' when in FM mode
    if (this.fmMode) this.repeat = 'all';
  },

  /**
   * Replace queue with similar songs based on given song
   */
  async replaceWithSimilar(songId) {
    try {
      const songs = await NeteaseAPI.getSimilarSongs(songId);
      if (!songs || songs.length === 0) {
        this.showToast('💓 暂未找到相似歌曲');
        return;
      }
      
      const songList = songs.map(s => ({
        id: s.id,
        name: s.name,
        artist: (s.artists || []).map(a => a.name).join(' / '),
        cover: s.album?.picUrl || s.al?.picUrl || '',
        duration: s.duration || 0,
        source: 'netease',
      }));
      
      this.queue = songList;
      this.currentIndex = 0;
      this.updatePlaylistUI();
      this.playById(songList[0].id, songList);
      this.showToast(`💓 已生成 ${songList.length} 首相似歌曲`);
    } catch (e) {
      console.log('Heart mode error:', e.message);
      this.showToast('💓 获取推荐失败');
    }
  },

  /**
   * When heart mode active and song ends, queue next batch of similar songs
   */
  async queueSimilarSongs(songId) {
    if (!this.heartMode) return;
    try {
      const songs = await NeteaseAPI.getSimilarSongs(songId);
      if (!songs || songs.length === 0) return;
      
      const songList = songs.map(s => ({
        id: s.id,
        name: s.name,
        artist: (s.artists || []).map(a => a.name).join(' / '),
        cover: s.album?.picUrl || s.al?.picUrl || '',
        duration: s.duration || 0,
        source: 'netease',
      }));
      
      // Skip duplicates and add to end of queue
      let added = 0;
      for (const song of songList) {
        if (!this.queue.find(q => q.id === song.id || q.id == song.id)) {
          this.queue.push(song);
          added++;
        }
      }
      
      if (added > 0) {
        this.updatePlaylistUI();
      }
    } catch (e) {
      console.log('Queue similar error:', e.message);
    }
  },

  /**
   * Add songs to queue
   */
  addToQueue(songs) {
    const added = [];
    for (const song of songs) {
      if (!this.queue.find(s => s.id === song.id || s.id == song.id)) {
        this.queue.push(song);
        added.push(song);
      }
    }
    if (added.length > 0) {
      this.updatePlaylistUI();
      this.showToast(`已添加 ${added.length} 首歌曲`);
    }
    return added;
  },

  /**
   * Remove a song from queue
   */
  removeFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return false;
    const removed = this.queue[index];
    this.queue.splice(index, 1);
    
    if (this.queue.length === 0) {
      this.clearPlaylist();
    } else {
      if (index === this.currentIndex) {
        // Currently playing song removed, play next
        this.currentIndex = Math.min(index, this.queue.length - 1);
        this.playById(this.queue[this.currentIndex].id, this.queue);
      } else if (index < this.currentIndex) {
        this.currentIndex--;
      }
      this.updatePlaylistUI();
    }
    
    this.showToast(`已移除: ${removed.name || removed.title || '未知歌曲'}`);
    return true;
  },

  // ======== Event Handlers ========
  onTimeUpdate() {
    const current = this.audio.currentTime;
    const duration = this.audio.duration || 0;
    
    // Update progress
    const percent = duration > 0 ? (current / duration) * 100 : 0;
    document.getElementById('progressFill').style.width = `${percent}%`;
    document.getElementById('currentTime').textContent = this.formatTime(current);
    
    // Update lyrics
    LyricsManager.update(current);
  },

  async onEnded() {
    if (this.repeat === 'one') {
      this.audio.currentTime = 0;
      this.audio.play();
    } else if (this.fmMode && this.currentIndex >= this.queue.length - 1) {
      // FM mode: fetch more songs when reaching the end
      this.showToast('📻 加载更多FM推荐...');
      try {
        const songs = await NeteaseAPI.getFmSongs();
        if (songs && songs.length > 0) {
          this.queue = this.queue.concat(songs);
          this.next();
          return;
        }
      } catch (e) {
        // Fall through to normal behavior
      }
      this.next();
    } else if (this.repeat === 'all' || this.currentIndex < this.queue.length - 1) {
      this.next();
    } else {
      this.isPlaying = false;
      this.updatePlayBtn();
    }
  },

  onLoadedMetadata() {
    document.getElementById('totalTime').textContent = this.formatTime(this.audio.duration || 0);
    this.fadeIn();
    this.audio.play().then(() => {
      this.isPlaying = true;
      this.updatePlayBtn();
    }).catch(e => {
      console.error('Autoplay failed:', e);
      this.isPlaying = false;
      this.updatePlayBtn();
    });
  },

  onError() {
    console.error('Audio playback error');
    this.showToast('⚠️ 播放出错，尝试下一首');
    this.isPlaying = false;
    this.updatePlayBtn();
  },

  onPlay() {
    this.isPlaying = true;
    this.updatePlayBtn();
    document.getElementById('playerCover').classList.add('playing');
    this.startVisualizer();
  },

  onPause() {
    this.isPlaying = false;
    this.updatePlayBtn();
    document.getElementById('playerCover').classList.remove('playing');
    this.stopVisualizer();
  },

  // ======== UI Updates ========
  updatePlayerUI() {
    const song = this.currentSong;
    if (!song) {
      document.getElementById('playerSongName').textContent = '未播放';
      document.getElementById('playerSongArtist').textContent = '';
      document.getElementById('playerCover').src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'56\' height=\'56\' viewBox=\'0 0 56 56\'%3E%3Crect width=\'56\' height=\'56\' fill=\'%23282828\'/%3E%3Ctext x=\'28\' y=\'34\' text-anchor=\'middle\' font-size=\'24\' fill=\'%23727272\'%3E🎵%3C/text%3E%3C/svg%3E';
      return;
    }
    
    document.getElementById('playerSongName').textContent = song.name || '未知歌曲';
    document.getElementById('playerSongArtist').textContent = song.artist || '';
    
    if (song.cover) {
      document.getElementById('playerCover').src = song.cover + '?param=100y100';
    }
    
    // Set page title
    document.title = `${song.name} - MusicWave`;
    this.updateLikeBtn();
  },

  updatePlayBtn() {
    const btn = document.getElementById('playBtn');
    btn.innerHTML = this.isPlaying ? icon('pause', 22) : icon('play', 22);
  },

  updateVolumeUI() {
    const fill = document.getElementById('volumeFill');
    const btn = document.getElementById('volumeBtn');
    
    fill.style.width = `${this.volume * 100}%`;
    
    if (this.isMuted || this.volume === 0) {
      btn.innerHTML = icon('volumeX', 18);
    } else if (this.volume < 0.3) {
      btn.innerHTML = icon('volume', 18);
    } else if (this.volume < 0.7) {
      btn.innerHTML = icon('volume1', 18);
    } else {
      btn.innerHTML = icon('volume2', 18);
    }
  },

  updatePlaylistUI() {
    const list = document.getElementById('playlistPanelList');
    const badge = document.getElementById('playlistBadge');
    
    badge.textContent = this.queue.length;
    badge.classList.toggle('show', this.queue.length > 0);
    
    if (this.queue.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-text">播放列表为空</div></div>`;
      list.style.paddingTop = '0';
      list.style.paddingBottom = '0';
      return;
    }
    
    // Virtual scroll: only render visible items
    const ITEM_H = 60;
    const BUFFER = 8;
    const scrollTop = list.scrollTop || 0;
    const clientH = list.clientHeight || 400;
    const totalH = this.queue.length * ITEM_H;
    
    const startIdx = Math.max(0, Math.floor(scrollTop / ITEM_H) - BUFFER);
    const endIdx = Math.min(this.queue.length, Math.ceil((scrollTop + clientH) / ITEM_H) + BUFFER);
    
    const visibleItems = [];
    for (let i = startIdx; i < endIdx; i++) {
      const song = this.queue[i];
      const isPlaying = i === this.currentIndex;
      const name = song.name || song.title || '未知歌曲';
      const artist = song.artist || song.singer || (song.ar ? song.ar.map(a => a.name).join(' / ') : '未知');
      const duration = song.duration || song.dt || 0;
      const cover = song.cover || song.picUrl || (song.al ? song.al.picUrl : '');
      const coverSrc = cover ? (cover + '?param=50y50') : '';
      
      visibleItems.push(`
        <div class="playlist-panel-item ${isPlaying ? 'playing' : ''}"
             draggable="true"
             data-index="${i}"
             ondragstart="Player.onDragStart(event, ${i})"
             ondragover="event.preventDefault();this.style.borderTop='2px solid var(--accent-color)'"
             ondragleave="this.style.borderTop=''"
             ondrop="Player.onDrop(event, ${i})"
             onclick="Player.playById(${song.id}, Player.queue)"
             style="position:relative;">
          <span class="panel-item-index">${isPlaying ? '▶' : (i + 1)}</span>
          ${coverSrc ? `<img class="panel-item-cover" src="${coverSrc}" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="panel-item-info">
            <div class="panel-item-title">${escapeHtml(name)}</div>
            <div class="panel-item-artist">${escapeHtml(artist)}</div>
          </div>
          <button class="player-btn" style="font-size:12px;width:24px;height:24px;flex-shrink:0;" onclick="event.stopPropagation();Player.removeFromQueue(${i})" title="移除">✕</button>
          <span class="panel-item-duration">${formatDuration(duration)}</span>
        </div>
      `);
    }
    
    list.innerHTML = visibleItems.join('');
    list.style.paddingTop = (startIdx * ITEM_H) + 'px';
    list.style.paddingBottom = ((this.queue.length - endIdx) * ITEM_H) + 'px';
    
    this.saveQueue();
  },

  updateTrackHighlight() {
    // Highlight current song in search results / playlist detail
    const tracks = document.querySelectorAll('.track-item');
    tracks.forEach(t => t.classList.remove('playing'));
    if (this.currentSong) {
      const currentTrack = document.querySelector(`.track-item[data-id="${this.currentSong.id}"]`);
      if (currentTrack) currentTrack.classList.add('playing');
    }
  },

  /**
   * Save queue to localStorage for session persistence
   */
  saveQueue() {
    try {
      const data = {
        queue: this.queue.slice(0, 100),
        currentIndex: this.currentIndex,
        currentSong: this.currentSong,
        timestamp: Date.now(),
      };
      localStorage.setItem('music_player_queue', JSON.stringify(data));
    } catch (e) {}
  },

  /**
   * Restore queue from localStorage
   */
  restoreQueue() {
    try {
      const raw = localStorage.getItem('music_player_queue');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data.timestamp || Date.now() - data.timestamp > 7200000) {
        localStorage.removeItem('music_player_queue');
        return;
      }
      if (data.queue && data.queue.length > 0) {
        this.queue = data.queue;
        this.currentIndex = Math.min(data.currentIndex || 0, this.queue.length - 1);
        if (data.currentSong) {
          this.currentSong = data.currentSong;
          this.updatePlayerUI();
        }
        this.updatePlaylistUI();
        // Scroll to current song in playlist
        setTimeout(() => {
          const list = document.getElementById('playlistPanelList');
          if (list && this.currentIndex >= 0) {
            list.scrollTop = this.currentIndex * 60;
          }
        }, 50);
      }
    } catch (e) {}
  },

  // ======== Drag & Drop Queue Reordering ========

  _dragIndex: null,

  onDragStart(e, index) {
    this._dragIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  },

  onDrop(e, dropIndex) {
    e.preventDefault();
    const from = this._dragIndex;
    if (from === null || from === dropIndex) return;

    // Reorder queue
    const [moved] = this.queue.splice(from, 1);
    this.queue.splice(dropIndex, 0, moved);

    // Update currentIndex
    if (this.currentIndex === from) {
      this.currentIndex = dropIndex;
    } else if (from < this.currentIndex && dropIndex >= this.currentIndex) {
      this.currentIndex--;
    } else if (from > this.currentIndex && dropIndex <= this.currentIndex) {
      this.currentIndex++;
    }

    this.updatePlaylistUI();
    this.updateTrackHighlight();
  },
  
  // ======== Audio Visualizer ========

  _audioCtx: null,
  _analyser: null,
  _animFrame: null,
  _sourceConnected: false,

  initVisualizer() {
    // We use a synthetic animated visualizer that doesn't need Web Audio API,
    // so audio output is never interrupted. The bars animate using sine waves.
  },

  startVisualizer() {
    if (this._animFrame) return;
    this.startFakeVisualizer();
  },

  /** Animated visualizer bars that don't block audio output */
  startFakeVisualizer() {
    const canvas = document.getElementById('visualizer');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bars = 48;
    let phase = 0;

    const draw = () => {
      this._animFrame = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const barW = w / bars;
      phase += 0.05;

      for (let i = 0; i < bars; i++) {
        const value = 0.2 + 0.3 * Math.sin(i * 0.15 + phase * 2) + 0.3 * Math.sin(i * 0.25 + phase);
        const barH = Math.max(2, value * h * 0.6);
        const hue = 140 + value * 30;
        ctx.fillStyle = 'hsla(' + hue + ', 80%, 55%, ' + (0.3 + value * 0.5) + ')';
        ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
      }
    };
    draw();
  },

  stopVisualizer() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
    const canvas = document.getElementById('visualizer');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  },

  resizeVisualizer() {
    const canvas = document.getElementById('visualizer');
    if (canvas) {
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
    }
  },

  /**
   * Show toast message with queue support
   */
  showToast(msg) {
    this._toastQueue = this._toastQueue || [];
    this._toastQueue.push(msg);
    if (this._toastQueue.length === 1) {
      this._showNextToast();
    }
  },

  _showNextToast() {
    if (!this._toastQueue || this._toastQueue.length === 0) return;
    const toast = document.getElementById('toast');
    toast.textContent = this._toastQueue[0];
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      this._toastQueue.shift();
      setTimeout(() => this._showNextToast(), 300);
    }, 2000);
  },

  /**
   * Format seconds to m:ss
   */
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  },
};

// Helper: format duration (milliseconds to m:ss)
function formatDuration(ms) {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
