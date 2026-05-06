/**
 * 歌曲宝 (gequbao.com) Music Crawler
 * Provides music search and playable URLs from gequbao.com
 */
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const BASE = 'https://www.gequbao.com';

/**
 * Search songs on gequbao.com
 * @param {string} keywords - Search keywords
 * @param {number} limit - Max results
 * @returns {Array} Song objects
 */
async function search(keywords, limit = 20) {
  try {
    const url = BASE + '/s/' + encodeURIComponent(keywords);
    const res = await axios.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 10000,
    });

    const songs = [];
    const seen = new Set();
    
    // Find the main search results section (before sidebar content)
    const mainEnd = res.data.indexOf('大家都在搜');
    const searchArea = mainEnd > 0 ? res.data.substring(0, mainEnd) : res.data;
    
    // Extract from title attribute — most reliable source of accurate names
    // Each song link: <a href="/music/{id}" title="{name} - {artist}">
    const titlePattern = /<a href="\/music\/(\d+)"[^>]*title="([^"]+)"[^>]*>/gi;
    let match;
    
    while ((match = titlePattern.exec(searchArea)) !== null && songs.length < limit) {
      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);
      
      const titleFull = match[2]; // e.g. "七里香 - 周杰伦"
      const parts = titleFull.split(' - ');
      const songName = parts[0] || titleFull;
      const artistName = parts.slice(1).join(' - ') || '';
      
      songs.push({
        id,
        name: songName,
        artist: artistName,
        album: '',
        cover: '',
        duration: 0,
        source: 'gequbao',
        _gequbaoId: id,
      });
    }

    return songs.slice(0, limit);
  } catch (e) {
    console.error('gequbao search error:', e.message);
    return [];
  }
}

/**
 * Get playable URL and metadata for a song
 * @param {string} songId - gequbao internal song ID
 * @returns {Promise<{url: string|null, title: string, author: string, cover: string}>}
 */
async function getPlayUrl(songId) {
  try {
    // Step 1: Get detail page and extract appData
    const detailUrl = BASE + '/music/' + songId;
    const detailRes = await axios.get(detailUrl, {
      headers: { 'User-Agent': UA },
      timeout: 10000,
    });

    // Extract appData JSON
    const start = detailRes.data.indexOf('window.appData');
    if (start === -1) return null;
    
    const snippet = detailRes.data.substring(start, start + 2000);
    const qStart = snippet.indexOf("'") + 1;
    const qEnd = snippet.indexOf("')", qStart);
    if (qStart === -1 || qEnd === -1) return null;
    
    const raw = snippet.substring(qStart, qEnd);
    
    // Clean up escaped unicode
    let clean = raw.replace(/\\u0022/g, '"');
    clean = clean.replace(/\\\\\//g, '/');
    
    const data = JSON.parse(clean);
    
    // Step 2: Get play URL from API
    const apiRes = await axios.post(BASE + '/api/play-url',
      'id=' + data.play_id,
      {
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': detailUrl,
        },
        timeout: 10000,
      }
    );

    const playUrl = apiRes.data?.data?.url || null;
    
    // Decode unicode: the raw JSON has \\uXXXX (double backslash) which JSON.parse
    // keeps as literal \uXXXX. We need to decode these properly.
    const decodeUnicode = (str) => {
      if (!str) return '';
      return str.replace(/\\u([\da-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    };
    
    const title = decodeUnicode(data.mp3_title || '');
    const author = decodeUnicode(data.mp3_author || '');
    const cover = (data.mp3_cover || '').replace(/\\\//g, '/');

    return {
      url: playUrl,
      title: title || '',
      author: author || '',
      cover: cover || '',
      duration: data.mp3_duration || '',
    };
  } catch (e) {
    console.error('gequbao play URL error:', e.message);
    return null;
  }
}

module.exports = { search, getPlayUrl };
