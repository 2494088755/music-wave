/**
 * Multi-Source Music Search & URL Provider
 * Provides search and playback URLs from multiple music platforms
 */
const axios = require('axios');
const gequbao = require('./gequbao-crawler');

const SOURCES = {
  netease: '网易云音乐',
  gequbao: '歌曲宝',
};

/**
 * Search songs from a specific source
 * @param {string} source - 'netease' or 'kugou'
 * @param {string} keywords - Search keywords
 * @param {number} limit - Number of results
 * @returns {Array} Array of song objects with { id, name, artist, album, source, playable }
 */
async function search(source, keywords, limit = 20) {
  switch (source) {
    case 'gequbao':
      return searchGequbao(keywords, limit);
    case 'netease':
    default:
      return searchNetease(keywords, limit);
  }
}

/**
 * Search NetEase Cloud Music (via simple API)
 */
async function searchNetease(keywords, limit) {
  try {
    const res = await axios.get('https://music.163.com/api/search/get/web', {
      params: { s: keywords, type: 1, limit },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/',
        'Cookie': 'os=pc; appver=2.0.2',
      },
      timeout: 10000,
    });
    
    const songs = res.data?.result?.songs || [];
    return songs.map(s => ({
      id: s.id,
      name: s.name || '未知',
      artist: (s.artists || s.ar || []).map(a => a.name).join(' / '),
      album: (s.album || s.al || {}).name || '',
      cover: (s.album || s.al || {}).picUrl || '',
      duration: s.duration || s.dt || 0,
      source: 'netease',
      playable: true,
    }));
  } catch (e) {
    console.error('Netease search error:', e.message);
    return [];
  }
}

/**
 * Search 歌曲宝 (gequbao.com)
 */
async function searchGequbao(keywords, limit) {
  const songs = await gequbao.search(keywords, limit);
  // Add source field if not already set
  return songs.map(s => ({ ...s, source: 'gequbao', playable: true }));
}

/**
 * Get a playable song URL from a specific source
 * @param {string} source - 'netease' or 'gequbao'
 * @param {string|number} songId - Song ID
 * @param {string} cookie - NetEase cookie (for netease source)
 * @returns {Promise<string|null>} - Playable URL or null
 */
async function getPlayUrl(source, songId, cookie = '') {
  switch (source) {
    case 'gequbao': {
      const result = await gequbao.getPlayUrl(songId);
      return result; // returns {url, title, author, cover} or null
    }
    case 'netease':
    default:
      return getNeteasePlayUrl(songId, cookie);
  }
}

/**
 * Get NetEase play URL
 */
async function getNeteasePlayUrl(songId, cookie) {
  try {
    const ncmApi = require('netease-cloud-music-api-alger');
    const result = await ncmApi.song_url_v1({ id: songId, level: 'standard', cookie });
    const data = result?.body?.data?.[0];
    if (data && data.url && data.code !== -110) {
      return data.url;
    }
    return null;
  } catch (e) {
    console.error('Netease URL error:', e.message);
    return null;
  }
}

module.exports = { search, getPlayUrl, SOURCES };
