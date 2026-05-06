/**
 * Multi-source Music Crawler
 * Tries multiple sources when NetEase API cannot provide a playable URL
 */
const axios = require('axios');
const crypto = require('crypto');

/**
 * Search for a song on KuGou Music and return playable URLs
 * @param {string} songName - Song name
 * @param {string} artist - Artist name
 * @returns {Promise<string|null>} - Playable audio URL or null
 */
async function searchKugou(songName, artist = '') {
  try {
    const keyword = artist ? `${songName} ${artist}` : songName;
    
    // Step 1: Search for the song
    const searchRes = await axios.get('http://mobilecdn.kugou.com/api/v3/search/song', {
      params: { format: 'json', keyword, page: 1, pagesize: 10, showtype: 1 },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    const songs = searchRes.data?.data?.info || [];
    if (songs.length === 0) return null;
    
    // Try each song's hash to find a playable URL
    for (const song of songs) {
      const hash = song.hash || song.sqhash || '';
      if (!hash) continue;
      
      try {
        // Step 2: Get song info with play URL
        const infoRes = await axios.get('http://m.kugou.com/app/i/getSongInfo.php', {
          params: { cmd: 'playInfo', hash, from: 'mkugou' },
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 5000
        });
        
        const data = infoRes.data;
        
        // Try to construct play URL from available info
        if (data.url) return data.url;
        
        // Try alternative: use extra hashes with tracker CDN
        const extra = data.extra || {};
        const tryHashes = [
          extra.sqhash,   // Lossless
          extra['320hash'], // 320kbps
          extra.highhash,   // High quality
          hash              // 128kbps original
        ].filter(Boolean);
        
        for (const tryHash of tryHashes) {
          const url = await getKugouPlayUrl(tryHash);
          if (url) return url;
        }
      } catch (e) {
        continue; // Try next result
      }
    }
    
    return null;
  } catch (error) {
    console.error('KuGou search error:', error.message);
    return null;
  }
}

/**
 * Get play URL from KuGou tracker CDN
 */
async function getKugouPlayUrl(hash) {
  try {
    const key = crypto.createHash('md5').update(hash.toUpperCase() + 'kgcloudv2').digest('hex');
    
    const res = await axios.get('http://trackercdn.kugou.com/i/v2/', {
      params: {
        hash: hash.toUpperCase(),
        key,
        pid: '3',
        cmd: '25',
        behavior: 'play',
      },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 5000
    });
    
    if (res.data?.status === 1 && res.data?.url) {
      return res.data.url;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Main function to find a playable song URL from any source
 * @param {string} songName - Song name
 * @param {string} artist - Artist name
 * @returns {Promise<string|null>} - Playable URL or null
 */
async function findSongUrl(songName, artist = '') {
  console.log(`[Crawler] Searching for: ${songName} - ${artist}`);
  
  // Try KuGou as fallback
  const kugouUrl = await searchKugou(songName, artist);
  if (kugouUrl) {
    console.log(`[Crawler] Found on KuGou: ${kugouUrl.substring(0, 60)}...`);
    return kugouUrl;
  }
  
  console.log(`[Crawler] No source found for: ${songName}`);
  return null;
}

module.exports = { findSongUrl, searchKugou };
