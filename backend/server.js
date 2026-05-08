/**
 * Music Player Backend Server
 * Serves both API and frontend static files
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const netease = require('./netease-api');
const ncmApi = require('netease-cloud-music-api-alger');
const { findSongUrl } = require('./music-crawler');
const multiSource = require('./multi-source');
const playlistStore = require('./playlist-store');

const app = express();
const PORT = process.env.PORT || 3000;
const axios = require('axios');

// Special mode cache directory
const SPECIAL_CACHE_DIR = path.join(__dirname, '.special-cache');
if (!fs.existsSync(SPECIAL_CACHE_DIR)) {
  fs.mkdirSync(SPECIAL_CACHE_DIR, { recursive: true });
  console.log('📁 Created special cache directory');
}

// Cookie persistence file
const COOKIE_FILE = path.join(__dirname, '.netease_cookie');
const GUEST_COOKIE_FILE = path.join(__dirname, '.guest_cookie');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory (frontend files)
// Try multiple possible locations for Railway compatibility
const publicDir = path.join(__dirname, 'public');
const altDir = path.join(process.cwd(), 'public');
let staticDir = null;

if (fs.existsSync(publicDir)) {
  staticDir = publicDir;
} else if (fs.existsSync(altDir)) {
  staticDir = altDir;
} else {
  // Try parent of cwd (Railway deploys entire repo, cwd = backend/)
  const parentDir = path.join(process.cwd(), '..', 'public');
  if (fs.existsSync(parentDir)) {
    staticDir = parentDir;
  }
}

if (staticDir) {
  app.use(express.static(staticDir));
  console.log('📂 Serving static from:', staticDir);
  console.log('📄 index.html exists:', fs.existsSync(path.join(staticDir, 'index.html')));
} else {
  console.log('⚠️ Could not find public directory');
  console.log('  Tried:', publicDir);
  console.log('  Tried:', altDir);
  console.log('  Tried:', path.join(process.cwd(), '..', 'public'));
}

// Cookie storage for session (in-memory) — load from file on startup
let cookieStore = '';
try {
  if (fs.existsSync(COOKIE_FILE)) {
    cookieStore = fs.readFileSync(COOKIE_FILE, 'utf8').trim();
    console.log('📁 Cookie loaded from file');
  }
} catch (e) {
  console.log('No saved cookie found');
}

let loginUserInfo = null;

// Guest cookie storage (for unauthenticated users)
let guestCookieStore = '';
try {
  if (fs.existsSync(GUEST_COOKIE_FILE)) {
    guestCookieStore = fs.readFileSync(GUEST_COOKIE_FILE, 'utf8').trim();
    if (guestCookieStore) console.log('📁 Guest cookie loaded from file');
  }
} catch (e) {
  console.log('No guest cookie found');
}

// ============ API Routes ============

// Health check for Railway
app.get('/health', (req, res) => res.send('OK'));
app.head('/health', (req, res) => res.status(200).end());

/**
 * GET /api/search?keywords=xxx&limit=20&offset=0
 * Search for songs
 */
app.get('/api/search', async (req, res) => {
  try {
    const { keywords, limit = 20, offset = 0 } = req.query;
    if (!keywords) {
      return res.json({ code: 400, msg: '请提供搜索关键词' });
    }
    const data = await netease.searchSongs(keywords, parseInt(limit), parseInt(offset));
    res.json({ code: 200, data: data.result || data });
  } catch (error) {
    res.json({ code: 500, msg: '搜索失败', error: error.message });
  }
});

/**
 * GET /api/song/url?id=xxx
 * Get song playback URL — uses proper weapi encryption, falls back to crawler
 */
app.get('/api/song/url', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.json({ code: 400, msg: '请提供歌曲ID' });
    }
    
    const songId = parseInt(id);
    
    // Step 1: If guest cookie is set, try it FIRST (user-pasted cookie takes priority)
    let audioUrl = null;
    let songName = '';
    let artistName = '';
    
    if (guestCookieStore) {
      try {
        const result = await ncmApi.song_url_v1({ id: songId, level: 'standard', cookie: guestCookieStore });
        const data = result.body?.data?.[0];
        if (data && data.url && data.code !== -110) {
          audioUrl = data.url;
        }
      } catch (e) {
        console.log(`Guest cookie URL failed: ${e.message}`);
      }
    }
    
    // Step 2: If no URL, try with login cookie
    if (!audioUrl) {
      try {
        const result = await ncmApi.song_url_v1({ id: songId, level: 'standard', cookie: cookieStore });
        if (result.cookie) mergeCookies(result.cookie);
        const data = result.body?.data?.[0];
        if (data && data.url && data.code !== -110) {
          audioUrl = data.url;
        }
      } catch (e) {
        console.log(`ncmApi URL failed: ${e.message}`);
      }
    }
    
    // Step 3: If no URL, try fallback crawler
    if (!audioUrl) {
      try {
        const detailRes = await netease.getSongDetail(songId);
        const song = detailRes?.songs?.[0];
        if (song) {
          songName = song.name || '';
          artistName = (song.ar || []).map(a => a.name).join(' ');
        }
      } catch (e) {
        // Ignore detail fetch errors
      }
      
      // Try fallback crawler
      if (songName) {
        audioUrl = await findSongUrl(songName, artistName);
      }
    }
    
    // Step 3: Also try without cookie for non-VIP songs
    if (!audioUrl) {
      try {
        const result = await ncmApi.song_url_v1({ id: songId, level: 'standard' });
        const data = result.body?.data?.[0];
        if (data && data.url && data.code !== -110) {
          audioUrl = data.url;
        }
      } catch (e) {
        // Ignore
      }
    }
    
    if (audioUrl) {
      res.json({ code: 200, data: [{ id: songId, url: audioUrl }] });
    } else {
      res.json({ code: 200, data: [{ id: songId, url: null, code: -110 }] });
    }
  } catch (error) {
    res.json({ code: 500, msg: '获取歌曲URL失败', error: error.message });
  }
});

/**
 * GET /api/song/detail?id=xxx
 * Get song details
 */
app.get('/api/song/detail', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.json({ code: 400, msg: '请提供歌曲ID' });
    const data = await netease.getSongDetail(parseInt(id));
    res.json({ code: 200, data });
  } catch (error) {
    res.json({ code: 500, msg: '获取歌曲详情失败', error: error.message });
  }
});

/**
 * GET /api/lyric?id=xxx
 * Get song lyrics
 */
app.get('/api/lyric', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.json({ code: 400, msg: '请提供歌曲ID' });
    }
    const data = await netease.getLyric(parseInt(id));
    res.json({ code: 200, data });
  } catch (error) {
    res.json({ code: 500, msg: '获取歌词失败', error: error.message });
  }
});

/**
 * GET /api/playlist?id=xxx
 * Get playlist detail
 */
app.get('/api/playlist', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.json({ code: 400, msg: '请提供歌单ID' });
    }
    const data = await netease.getPlaylistDetail(parseInt(id));
    res.json({ code: 200, data: data.playlist || data });
  } catch (error) {
    res.json({ code: 500, msg: '获取歌单失败', error: error.message });
  }
});

/**
 * GET /api/playlist/tracks?id=xxx
 * Get all tracks from a playlist (including track details)
 */
app.get('/api/playlist/tracks', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.json({ code: 400, msg: '请提供歌单ID' });
    }
    const data = await netease.getPlaylistTracks(parseInt(id));
    const playlist = data.playlist || data;
    res.json({ code: 200, data: playlist });
  } catch (error) {
    res.json({ code: 500, msg: '获取歌单曲目失败', error: error.message });
  }
});

/**
 * GET /api/top/playlists?cat=全部&limit=30&offset=0
 * Get top playlists
 */
app.get('/api/top/playlists', async (req, res) => {
  try {
    const { cat = '全部', limit = 30, offset = 0 } = req.query;
    const data = await netease.getTopPlaylists(cat, parseInt(limit), parseInt(offset));
    // toplist returns { list: [...] }
    res.json({ code: 200, data: data.list || data });
  } catch (error) {
    res.json({ code: 500, msg: '获取歌单失败', error: error.message });
  }
});

/**
 * GET /api/recommended/playlists
 * Get recommended playlists
 */
app.get('/api/recommended/playlists', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const data = await netease.getRecommendedPlaylists(limit);
    res.json({ code: 200, data: data.result || data });
  } catch (error) {
    res.json({ code: 500, msg: '获取推荐歌单失败', error: error.message });
  }
});

/**
 * GET /api/simi/songs?id=xxx
 * Get similar songs
 */
app.get('/api/simi/songs', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.json({ code: 400, msg: '请提供歌曲ID' });
    const data = await netease.getSimilarSongs(parseInt(id), cookieStore);
    res.json({ code: 200, data: data.songs || data });
  } catch (error) {
    res.json({ code: 500, msg: '获取相似歌曲失败', error: error.message });
  }
});

/**
 * GET /api/multi/search?source=kugou&keywords=xxx&limit=20
 * Multi-source music search
 */
app.get('/api/multi/search', async (req, res) => {
  try {
    const { source = 'netease', keywords, limit = 20 } = req.query;
    if (!keywords) return res.json({ code: 400, msg: '请提供搜索关键词' });
    
    const songs = await multiSource.search(source, keywords, parseInt(limit));
    res.json({ code: 200, data: { songs, source } });
  } catch (error) {
    res.json({ code: 500, msg: '搜索失败', error: error.message });
  }
});

/**
 * GET /api/multi/url?source=kugou&id=xxx
 * Get playable URL from specific source
 */
app.get('/api/multi/url', async (req, res) => {
  try {
    const { source = 'netease', id } = req.query;
    if (!id) return res.json({ code: 400, msg: '请提供歌曲ID' });
    
    const result = await multiSource.getPlayUrl(source, id, cookieStore);
    if (result) {
      if (typeof result === 'string') {
        res.json({ code: 200, data: { url: result } });
      } else {
        res.json({ code: 200, data: result });
      }
    } else {
      res.json({ code: 200, data: { url: null } });
    }
  } catch (error) {
    res.json({ code: 500, msg: '获取播放链接失败', error: error.message });
  }
});

/**
 * GET /api/multi/sources
 * List available music sources
 */
app.get('/api/multi/sources', (req, res) => {
  res.json({ code: 200, data: multiSource.SOURCES });
});

// ============ Login Routes (using netease-cloud-music-api-alger) ============

/**
 * GET /api/login/qr
 * One-stop QR login: get key + create QR + return QR image as base64
 */
app.get('/api/login/qr', async (req, res) => {
  try {
    // Step 1: Get unikey
    const keyResult = await ncmApi.login_qr_key({ type: 1, cookie: cookieStore });
    if (!keyResult.body || !keyResult.body.data || !keyResult.body.data.unikey) {
      return res.json({ code: 500, msg: '获取二维码密钥失败' });
    }
    const unikey = keyResult.body.data.unikey;
    
    // Merge cookies
    if (keyResult.cookie) mergeCookies(keyResult.cookie);
    
    // Step 2: Create QR code
    const qrResult = await ncmApi.login_qr_create({ key: unikey, qrimg: 'true', type: 1, cookie: cookieStore });
    if (qrResult.cookie) mergeCookies(qrResult.cookie);
    
    const qrimg = qrResult.body && qrResult.body.data ? qrResult.body.data.qrimg : '';
    
    res.json({
      code: 200,
      data: { unikey, qrimg }
    });
  } catch (error) {
    res.json({ code: 500, msg: '获取二维码失败', error: error.message });
  }
});

/**
 * GET /api/login/qr/check?key=xxx
 * Check QR code login status
 */
app.get('/api/login/qr/check', async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.json({ code: 400, msg: '请提供密钥' });
    
    const result = await ncmApi.login_qr_check({ key, type: 1, cookie: cookieStore });
    
    if (result.cookie) mergeCookies(result.cookie);
    
    // If login successful (body.code === 803), fetch user info
    if (result.body && result.body.code === 803) {
      // Extract MUSIC_U from cookie
      const musicUCookie = (result.cookie || []).find(c => c.startsWith('MUSIC_U='));
      if (musicUCookie) {
        cookieStore = musicUCookie.split(';')[0] + '; ';
      }
      
      // Get login status - response is { data: { code: 200, profile: {...}, account: {...} } }
      const statusResult = await ncmApi.login_status({ cookie: cookieStore });
      if (statusResult.cookie) mergeCookies(statusResult.cookie);
      
      // Check body.data for account info
      const statusData = statusResult.body && statusResult.body.data;
      if (statusData && statusData.code === 200 && statusData.profile) {
        result.body.userInfo = statusData.profile;
        // Also store loginUserInfo
        loginUserInfo = statusData.profile;
      }
    }
    
    res.json({
      code: 200,
      data: result.body || result
    });
  } catch (error) {
    res.json({ code: 500, msg: '检查登录状态失败', error: error.message });
  }
});

/**
 * GET /api/login/status
 * Get current login status
 * Response format from ncmApi: { body: { data: { code, account, profile } } }
 */
app.get('/api/login/status', async (req, res) => {
  try {
    const result = await ncmApi.login_status({ cookie: cookieStore });
    if (result.cookie) mergeCookies(result.cookie);
    
    // Check body.data.profile to determine login status
    const data = result.body && result.body.data;
    const isLoggedIn = data && data.code === 200 && data.profile !== null;
    
    res.json({
      code: 200,
      loggedIn: isLoggedIn,
      userInfo: isLoggedIn ? data.profile : null,
    });
  } catch (error) {
    res.json({ code: 500, msg: '获取登录状态失败', error: error.message });
  }
});

/**
 * POST /api/login/phone
 * Login with phone and password
 * Response from ncmApi: { body: { code, profile, account, token, cookie }, cookie: [...] }
 */
app.post('/api/login/phone', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.json({ code: 400, msg: '请提供手机号和密码' });
    }
    const result = await ncmApi.login_cellphone({ phone, password, cookie: cookieStore });
    if (result.cookie) mergeCookies(result.cookie);
    
    if (result.body && result.body.code === 200) {
      const musicUCookie = (result.cookie || []).find(c => c.startsWith('MUSIC_U='));
      if (musicUCookie) {
        cookieStore = musicUCookie.split(';')[0] + '; ';
      }
      loginUserInfo = result.body.profile || result.body.account || null;
    }
    
    res.json({ code: 200, data: result.body || result });
  } catch (error) {
    res.json({ code: 500, msg: '手机号登录失败', error: error.message });
  }
});

/**
 * GET /api/user/playlist?uid=xxx
 * Get user's playlists
 */
app.get('/api/user/playlist', async (req, res) => {
  try {
    const { uid, limit = 50, offset = 0 } = req.query;
    const userId = uid || (loginUserInfo && loginUserInfo.userId);
    if (!userId) {
      return res.json({ code: 400, msg: '未登录或未提供用户ID' });
    }
    const data = await netease.getUserPlaylists(parseInt(userId), parseInt(limit), parseInt(offset));
    res.json({ code: 200, data: data.playlist || data });
  } catch (error) {
    res.json({ code: 500, msg: '获取用户歌单失败', error: error.message });
  }
});

/**
 * GET /api/user/detail?uid=xxx
 * Get user detail
 */
app.get('/api/user/detail', async (req, res) => {
  try {
    const { uid } = req.query;
    const userId = uid || (loginUserInfo && loginUserInfo.userId);
    if (!userId) {
      return res.json({ code: 400, msg: '未登录或未提供用户ID' });
    }
    const data = await netease.getUserDetail(parseInt(userId));
    res.json({ code: 200, data });
  } catch (error) {
    res.json({ code: 500, msg: '获取用户详情失败', error: error.message });
  }
});

// ============ Sync Routes ============

/**
 * POST /api/sync/netease-playlists
 * Sync all user's NetEase playlists to local playlists
 */
app.post('/api/sync/netease-playlists', async (req, res) => {
  try {
    const userId = loginUserInfo && loginUserInfo.userId;
    if (!userId) {
      return res.json({ code: 400, msg: '请先登录' });
    }

    // Get user's NetEase playlists
    const data = await netease.getUserPlaylists(userId, 100, 0);
    const remotePlaylists = data.playlist || data || [];
    if (!remotePlaylists.length) {
      return res.json({ code: 200, data: { synced: 0, skipped: 0, errors: [] } });
    }

    let synced = 0;
    let skipped = 0;
    const errors = [];

    for (const pl of remotePlaylists) {
      try {
        // Check if already synced
        if (playlistStore.findByNeteaseId(pl.id)) {
          skipped++;
          continue;
        }

        // Fetch all tracks
        const trackData = await netease.getPlaylistTracks(pl.id);
        const tracks = trackData.tracks || [];

        // Format songs for local storage
        const songs = tracks.map(t => ({
          id: t.id,
          name: t.name || '',
          artist: (t.ar || []).map(a => a.name).join(' / ') || '未知',
          cover: (t.al || {}).picUrl || '',
          duration: t.dt || 0,
          source: 'netease',
        }));

        // Create local playlist
        const localPlaylist = playlistStore.create(
          pl.name || '未命名歌单',
          pl.description || '',
          String(pl.id)
        );

        // Add all songs
        for (const song of songs) {
          playlistStore.addSong(localPlaylist.id, song);
        }

        synced++;
      } catch (e) {
        errors.push({ playlistId: pl.id, name: pl.name, error: e.message });
      }
    }

    res.json({ code: 200, data: { synced, skipped, errors } });
  } catch (error) {
    res.json({ code: 500, msg: '同步失败', error: error.message });
  }
});

// ============ Special Mode Routes ============

/**
 * POST /api/special/save-song
 * Download a song and save it to server cache for special environment playback
 */
app.post('/api/special/save-song', async (req, res) => {
  try {
    const { id, source } = req.body;
    if (!id) return res.json({ code: 400, msg: '请提供歌曲ID' });

    // Get the audio URL using the same logic as /api/song/url
    let audioUrl = null;
    const songId = parseInt(id);

    // Try guest cookie first if available
    if (guestCookieStore) {
      try {
        const result = await ncmApi.song_url_v1({ id: songId, level: 'standard', cookie: guestCookieStore });
        const data = result.body?.data?.[0];
        if (data && data.url && data.code !== -110) audioUrl = data.url;
      } catch (e) { /* ignore */ }
    }

    // Then try login cookie
    if (!audioUrl) {
      try {
        const result = await ncmApi.song_url_v1({ id: songId, level: 'standard', cookie: cookieStore });
        if (result.cookie) mergeCookies(result.cookie);
        const data = result.body?.data?.[0];
        if (data && data.url && data.code !== -110) {
          audioUrl = data.url;
        }
      } catch (e) {
        // Ignore ncmApi errors
      }
    }

    if (!audioUrl) {
      try {
        const detailRes = await netease.getSongDetail(songId);
        const song = detailRes?.songs?.[0];
        const songName = song ? song.name : '';
        const artistName = song ? (song.ar || []).map(a => a.name).join(' ') : '';
        
        if (songName) {
          const fallback = await findSongUrl(`${songName} ${artistName}`);
          if (typeof fallback === 'string') {
            audioUrl = fallback;
          } else if (fallback && fallback.url) {
            audioUrl = fallback.url;
          }
        }
      } catch (e) {
        // Ignore crawler errors
      }
    }

    if (!audioUrl) {
      return res.json({ code: 500, msg: '无法获取歌曲下载地址' });
    }

    // Download the audio file
    const ext = path.extname(new URL(audioUrl).pathname) || '.mp3';
    const fileName = `${songId}${ext}`;
    const filePath = path.join(SPECIAL_CACHE_DIR, fileName);
    
    const response = await axios({
      method: 'GET',
      url: audioUrl,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/',
      },
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`[Special] Saved: ${fileName}`);
    res.json({
      code: 200,
      data: {
        localUrl: `/api/special/play/${fileName}`,
        fileName,
      },
    });
  } catch (error) {
    res.json({ code: 500, msg: '保存歌曲失败', error: error.message });
  }
});

/**
 * POST /api/special/clear
 * Clear all cached song files on the server
 */
app.post('/api/special/clear', (req, res) => {
  try {
    const files = fs.readdirSync(SPECIAL_CACHE_DIR);
    let cleared = 0;
    for (const file of files) {
      const filePath = path.join(SPECIAL_CACHE_DIR, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        cleared++;
      }
    }
    console.log(`[Special] Cleared ${cleared} cached files`);
    res.json({ code: 200, data: { cleared } });
  } catch (error) {
    res.json({ code: 500, msg: '清空缓存失败', error: error.message });
  }
});

/**
 * GET /api/special/play/:file
 * Serve cached audio file for playback
 */
app.get('/api/special/play/:file', (req, res) => {
  const filePath = path.join(SPECIAL_CACHE_DIR, req.params.file);
  // Prevent path traversal
  if (!filePath.startsWith(SPECIAL_CACHE_DIR)) {
    return res.status(403).send('Forbidden');
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  res.sendFile(filePath);
});

// ============ Guest Cookie Routes ============

/**
 * POST /api/guest/cookie
 * Save a guest cookie for unauthenticated users
 */
app.post('/api/guest/cookie', (req, res) => {
  try {
    const { cookie } = req.body;
    if (!cookie || !cookie.trim()) {
      return res.json({ code: 400, msg: '请提供有效的 Cookie' });
    }
    guestCookieStore = cookie.trim();
    fs.writeFileSync(GUEST_COOKIE_FILE, guestCookieStore, 'utf8');
    console.log('📁 Guest cookie saved');
    res.json({ code: 200, data: { hasCookie: true } });
  } catch (error) {
    res.json({ code: 500, msg: '保存失败', error: error.message });
  }
});

/**
 * POST /api/guest/clear
 * Clear the guest cookie
 */
app.post('/api/guest/clear', (req, res) => {
  try {
    guestCookieStore = '';
    if (fs.existsSync(GUEST_COOKIE_FILE)) fs.unlinkSync(GUEST_COOKIE_FILE);
    console.log('📁 Guest cookie cleared');
    res.json({ code: 200, data: { hasCookie: false } });
  } catch (error) {
    res.json({ code: 500, msg: '清除失败', error: error.message });
  }
});

/**
 * GET /api/guest/status
 * Check if guest cookie is stored
 */
app.get('/api/guest/status', (req, res) => {
  res.json({
    code: 200,
    data: { hasCookie: !!guestCookieStore },
  });
});

// ============ Playlist Routes (local) ============

/**
 * POST /api/playlist/create
 * Create a new playlist
 */
app.post('/api/playlist/create', (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.json({ code: 400, msg: '请输入歌单名称' });
  const playlist = playlistStore.create(name.trim(), description || '');
  res.json({ code: 200, data: playlist });
});

/**
 * GET /api/playlist/list
 * List all local playlists
 */
app.get('/api/playlist/list', (req, res) => {
  const playlists = playlistStore.list();
  res.json({ code: 200, data: playlists });
});

/**
 * GET /api/playlist/get?id=xxx
 * Get a playlist with songs
 */
app.get('/api/playlist/get', (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ code: 400, msg: '请提供歌单ID' });
  const playlist = playlistStore.get(id);
  if (!playlist) return res.json({ code: 404, msg: '歌单不存在' });
  res.json({ code: 200, data: playlist });
});

/**
 * POST /api/playlist/add-song
 * Add a song to a playlist
 */
app.post('/api/playlist/add-song', (req, res) => {
  const { playlistId, song } = req.body;
  if (!playlistId || !song) return res.json({ code: 400, msg: '参数不完整' });
  const result = playlistStore.addSong(playlistId, song);
  if (result.error) return res.json({ code: 400, msg: result.error });
  res.json({ code: 200, data: result.playlist });
});

/**
 * POST /api/playlist/remove-song
 * Remove a song from a playlist
 */
app.post('/api/playlist/remove-song', (req, res) => {
  const { playlistId, songId } = req.body;
  if (!playlistId || !songId) return res.json({ code: 400, msg: '参数不完整' });
  const result = playlistStore.removeSong(playlistId, songId);
  if (result.error) return res.json({ code: 400, msg: result.error });
  res.json({ code: 200, data: result.playlist });
});

/**
 * POST /api/playlist/delete
 * Delete a playlist
 */
app.post('/api/playlist/delete', (req, res) => {
  const { id } = req.body;
  if (!id) return res.json({ code: 400, msg: '请提供歌单ID' });
  const result = playlistStore.remove(id);
  if (result.error) return res.json({ code: 400, msg: result.error });
  res.json({ code: 200, msg: '歌单已删除' });
});

/**
 * POST /api/logout
 * Logout
 */
app.post('/api/logout', async (req, res) => {
  cookieStore = '';
  loginUserInfo = null;
  try {
    if (fs.existsSync(COOKIE_FILE)) fs.unlinkSync(COOKIE_FILE);
  } catch (e) {}
  res.json({ code: 200, msg: '已退出登录' });
});

// Helper: merge cookies from ncmApi responses and persist to file
function mergeCookies(cookies) {
  if (!cookies || !Array.isArray(cookies)) return;
  let changed = false;
  for (const cookie of cookies) {
    const parts = cookie.split(';')[0]; // Get name=value before first ;
    if (parts.includes('=')) {
      const name = parts.split('=')[0].trim();
      if (['MUSIC_U', '__csrf', 'MUSIC_A', 'MUSIC_R', 'NMTID'].includes(name)) {
        const regex = new RegExp(`${name}=[^;]*;?\\s*`, 'g');
        const newStore = cookieStore.replace(regex, '');
        if (newStore !== cookieStore + parts + '; ') {
          cookieStore = newStore + parts + '; ';
          changed = true;
        }
      }
    }
  }
  // Persist to file if changed
  if (changed && cookieStore) {
    try {
      fs.writeFileSync(COOKIE_FILE, cookieStore, 'utf8');
      console.log('💾 Cookie saved to file');
    } catch (e) {
      console.error('Failed to save cookie:', e.message);
    }
  }
}

// Fallback: serve index.html for unmatched routes (SPA support / Railway fallback)
app.get('*', (req, res) => {
  if (staticDir) {
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  res.status(404).send('Static files not found. Server is running but frontend directory is missing.');
});

// ============ Start Server ============
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Music Player Server is running!`);
  console.log(`📍 Local:   http://localhost:${PORT}`);
  console.log(`📱 Network: http://0.0.0.0:${PORT}`);
});
