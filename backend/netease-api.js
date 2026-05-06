/**
 * NetEase Cloud Music API Wrapper
 * Uses the simple /api/ endpoint (no weapi encryption needed for most calls)
 */
const axios = require('axios');

const BASE_URL = 'https://music.163.com/api';
const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://music.163.com/',
  'Cookie': 'os=pc; appver=2.0.2',
};

/**
 * Make a simple GET request to NetEase API
 */
async function apiGet(endpoint, params = {}, cookie = '') {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { ...COMMON_HEADERS };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  try {
    const response = await axios.get(url, { params, headers });
    return {
      data: response.data,
      cookies: response.headers['set-cookie'] || []
    };
  } catch (error) {
    console.error(`API GET Error [${endpoint}]:`, error.message);
    throw error;
  }
}

/**
 * Make a simple POST request to NetEase API
 */
async function apiPost(endpoint, data = {}, cookie = '') {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    ...COMMON_HEADERS,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  try {
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value);
    }

    const response = await axios.post(url, formData.toString(), { headers });
    return {
      data: response.data,
      cookies: response.headers['set-cookie'] || []
    };
  } catch (error) {
    console.error(`API POST Error [${endpoint}]:`, error.message);
    throw error;
  }
}

/**
 * Search songs
 */
async function searchSongs(keywords, limit = 30, offset = 0) {
  const result = await apiGet('/search/get/web', {
    s: keywords,
    type: 1,
    limit,
    offset,
  });
  return result.data;
}

/**
 * Get song details (multiple songs)
 */
async function getSongDetail(songIds) {
  const ids = Array.isArray(songIds) ? songIds : [songIds];
  const result = await apiGet('/v3/song/detail', {
    c: JSON.stringify(ids.map(id => ({ id }))),
  });
  return result.data;
}

/**
 * Get song playback URL — tries multiple quality levels
 */
async function getSongUrl(songId) {
  // Try levels from highest to lowest
  const levels = ['standard', 'higher', 'exhigh'];
  
  for (const level of levels) {
    try {
      const result = await apiGet('/song/enhance/player/url/v1', {
        ids: JSON.stringify([songId]),
        level,
        encodeType: 'mp3,aac',
      });
      
      const data = result.data;
      if (data && data.data && data.data.length > 0) {
        const song = data.data[0];
        // code -110 means not available
        if (song.url && song.code !== -110) {
          return data;
        }
      }
    } catch (e) {
      // Continue to next level
    }
  }
  
  // If all levels fail, try without level parameter (last resort)
  const result = await apiGet('/song/enhance/player/url/v1', {
    ids: JSON.stringify([songId]),
    encodeType: 'mp3',
  });
  return result.data;
}

/**
 * Get song lyrics
 */
async function getLyric(songId) {
  const result = await apiGet('/song/lyric', {
    id: songId,
    lv: -1,
    kv: -1,
    tv: -1,
    rv: -1,
  });
  return result.data;
}

/**
 * Get playlist detail
 */
async function getPlaylistDetail(playlistId) {
  const result = await apiGet('/v6/playlist/detail', {
    id: playlistId,
    n: 100,
    s: 8,
  });
  return result.data;
}

/**
 * Get playlist tracks - extracts trackIds, then fetches full song details
 */
async function getPlaylistTracks(playlistId) {
  const detailData = await getPlaylistDetail(playlistId);
  const playlist = detailData.playlist || {};
  const trackIds = playlist.trackIds || [];
  
  if (trackIds.length === 0) {
    return { playlist, tracks: [] };
  }
  
  const ids = trackIds.map(t => t.id);
  const batchSize = 100;
  let allTracks = [];
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const detail = await getSongDetail(batch);
    if (detail.songs) {
      allTracks = allTracks.concat(detail.songs);
    }
  }
  
  playlist.tracks = allTracks;
  return { playlist, tracks: allTracks };
}

/**
 * Get user's playlists
 */
async function getUserPlaylists(userId, limit = 50, offset = 0) {
  const result = await apiGet('/user/playlist', {
    uid: userId,
    limit,
    offset,
  });
  return result.data;
}

/**
 * Get user detail
 */
async function getUserDetail(userId) {
  const result = await apiGet('/v1/user/detail', {
    uid: userId,
  });
  return result.data;
}

/**
 * Get QR code key (for login)
 */
async function getQRKey(cookie = '') {
  const result = await apiPost('/login/qr/key', { type: 1 }, cookie);
  return result;
}

/**
 * Create QR code
 */
async function createQR(key, qrimg = true, cookie = '') {
  const result = await apiPost('/login/qr/create', {
    key,
    qrimg: qrimg ? 'true' : 'false'
  }, cookie);
  return result;
}

/**
 * Check QR code login status
 * Returns: 800=expired, 801=waiting, 802=scanning, 803=confirmed (success)
 */
async function checkQRLogin(key, cookie = '') {
  const result = await apiPost('/login/qr/check', {
    key,
    type: 1
  }, cookie);
  return result;
}

/**
 * Get login status / current user info
 */
async function getLoginStatus(cookie = '') {
  try {
    const result = await apiPost('/w/nuser/account/get', {}, cookie);
    return result;
  } catch (error) {
    return { data: { code: -1 }, cookies: [] };
  }
}

/**
 * Get top playlists (for discovery)
 */
async function getTopPlaylists(cat = '全部', limit = 30, offset = 0) {
  const result = await apiGet('/toplist', {
    // toplist doesn't need special params
  });
  return result.data;
}

/**
 * Get recommended playlists (homepage)
 */
async function getRecommendedPlaylists(limit = 10) {
  const result = await apiGet('/personalized/playlist', {
    limit,
  });
  return result.data;
}

/**
 * Get hot songs from a playlist (first batch)
 */
async function getPlaylistTracks(playlistId) {
  // Same as getPlaylistDetail
  return getPlaylistDetail(playlistId);
}

/**
 * Get similar songs
 */
async function getSimilarSongs(songId, cookie = '') {
  const result = await apiGet('/v1/discovery/simiSong', {
    songid: songId,
    limit: 20,
  }, cookie);
  return result.data;
}

/**
 * Login with phone number
 */
async function loginWithPhone(phone, password, cookie = '') {
  const result = await apiPost('/login/cellphone', {
    phone,
    password,
    rememberLogin: 'true'
  }, cookie);
  return result;
}

module.exports = {
  searchSongs,
  getSongDetail,
  getSongUrl,
  getLyric,
  getPlaylistDetail,
  getUserPlaylists,
  getUserDetail,
  getQRKey,
  createQR,
  checkQRLogin,
  getLoginStatus,
  getTopPlaylists,
  getRecommendedPlaylists,
  getPlaylistTracks,
  getSimilarSongs,
  loginWithPhone,
};
