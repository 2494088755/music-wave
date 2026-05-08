/**
 * NetEase Cloud Music API Client (Frontend)
 * Communicates with our backend server
 */
const API_BASE = '';

const NeteaseAPI = {
  // ======== Search ========
  async search(keywords, limit = 30, offset = 0) {
    const res = await fetch(`${API_BASE}/api/search?keywords=${encodeURIComponent(keywords)}&limit=${limit}&offset=${offset}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.msg || '搜索失败');
    return data.data;
  },

  // ======== Song ========
  async getSongUrl(songId) {
    const res = await fetch(`${API_BASE}/api/song/url?id=${songId}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取歌曲URL失败');
    return data.data;
  },

  async getSongDetail(songId) {
    const res = await fetch(`${API_BASE}/api/song/detail?id=${songId}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取歌曲详情失败');
    return data.data;
  },

  async getLyric(songId) {
    const res = await fetch(`${API_BASE}/api/lyric?id=${songId}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取歌词失败');
    return data.data;
  },

  // ======== Playlist ========
  async getPlaylist(playlistId) {
    const res = await fetch(`${API_BASE}/api/playlist?id=${playlistId}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取歌单失败');
    return data.data;
  },

  async getPlaylistTracks(playlistId) {
    const res = await fetch(`${API_BASE}/api/playlist/tracks?id=${playlistId}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取歌单曲目失败');
    return data.data;
  },

  async getTopPlaylists(cat = '全部', limit = 30, offset = 0) {
    const res = await fetch(`${API_BASE}/api/top/playlists?cat=${encodeURIComponent(cat)}&limit=${limit}&offset=${offset}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取歌单失败');
    return data.data;
  },

  async getRecommendedPlaylists(limit = 30) {
    const res = await fetch(`${API_BASE}/api/recommended/playlists?limit=${limit}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取推荐歌单失败');
    return data.data;
  },

  async getSimilarSongs(songId) {
    const res = await fetch(`${API_BASE}/api/simi/songs?id=${songId}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取相似歌曲失败');
    return data.data;
  },

  // ======== Login ========
  async getLoginQR() {
    const res = await fetch(`${API_BASE}/api/login/qr`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取二维码失败');
    return data.data;
  },

  async checkQRLogin(key) {
    const res = await fetch(`${API_BASE}/api/login/qr/check?key=${key}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('检查登录状态失败');
    return data;
  },

  async getLoginStatus() {
    const res = await fetch(`${API_BASE}/api/login/status`);
    const data = await res.json();
    return data;
  },

  async getSimilarSongs(songId) {
    const res = await fetch(`${API_BASE}/api/simi/songs?id=${songId}`);
    const data = await res.json();
    if (data.code !== 200) return [];
    return data.data || [];
  },

  async getUserPlaylists(uid) {
    const res = await fetch(`${API_BASE}/api/user/playlist?uid=${uid}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取用户歌单失败');
    return data.data;
  },

  async getUserDetail(uid) {
    const res = await fetch(`${API_BASE}/api/user/detail?uid=${uid}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取用户信息失败');
    return data.data;
  },

  async logout() {
    const res = await fetch(`${API_BASE}/api/logout`, { method: 'POST' });
    return res.json();
  },

  async syncNeteasePlaylists() {
    const res = await fetch(`${API_BASE}/api/sync/netease-playlists`, { method: 'POST' });
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.msg || '同步失败');
    return data.data;
  },

  // ======== Guest Cookie ========
  async setGuestCookie(cookie) {
    const res = await fetch(`${API_BASE}/api/guest/cookie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie }),
    });
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.msg || '保存失败');
    return data.data;
  },

  async clearGuestCookie() {
    const res = await fetch(`${API_BASE}/api/guest/clear`, { method: 'POST' });
    const data = await res.json();
    if (data.code !== 200) throw new Error('清除失败');
    return data.data;
  },

  async getGuestCookieStatus() {
    const res = await fetch(`${API_BASE}/api/guest/status`);
    const data = await res.json();
    if (data.code !== 200) return { hasCookie: false };
    return data.data;
  },

  // ======== Multi-Source Search ========
  async multiSearch(source, keywords, limit = 20) {
    const res = await fetch(`${API_BASE}/api/multi/search?source=${source}&keywords=${encodeURIComponent(keywords)}&limit=${limit}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.msg || '搜索失败');
    return data.data;
  },

  async multiGetUrl(source, id) {
    const res = await fetch(`${API_BASE}/api/multi/url?source=${source}&id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('获取播放链接失败');
    return data.data;
  },

  async getSources() {
    const res = await fetch(`${API_BASE}/api/multi/sources`);
    const data = await res.json();
    if (data.code !== 200) return { netease: '网易云音乐' };
    return data.data;
  },

  // ======== Local Playlists ========
  async createPlaylist(name, description = '') {
    const res = await fetch(`${API_BASE}/api/playlist/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    return (await res.json()).data;
  },

  async getPlaylists() {
    const res = await fetch(`${API_BASE}/api/playlist/list`);
    return (await res.json()).data || [];
  },

  async getPlaylist(id) {
    const res = await fetch(`${API_BASE}/api/playlist/get?id=${id}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.msg || '获取歌单失败');
    return data.data;
  },

  async addSongToPlaylist(playlistId, song) {
    const res = await fetch(`${API_BASE}/api/playlist/add-song`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId, song }),
    });
    return res.json();
  },

  async removeSongFromPlaylist(playlistId, songId) {
    const res = await fetch(`${API_BASE}/api/playlist/remove-song`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId, songId }),
    });
    return res.json();
  },

  async deletePlaylist(id) {
    const res = await fetch(`${API_BASE}/api/playlist/delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.json();
  },
};
