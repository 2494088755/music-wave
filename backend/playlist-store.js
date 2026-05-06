/**
 * Local Playlist Storage
 * Persists user-created playlists to a JSON file
 */
const fs = require('fs');
const path = require('path');

const STORE_FILE = path.join(__dirname, '.playlists.json');

function load() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load playlists:', e.message);
  }
  return [];
}

function save(playlists) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(playlists, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save playlists:', e.message);
  }
}

/**
 * Create a new playlist
 */
function create(name, description = '') {
  const playlists = load();
  const playlist = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    description,
    songs: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  playlists.push(playlist);
  save(playlists);
  return playlist;
}

/**
 * List all playlists
 */
function list() {
  return load().map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    songCount: p.songs.length,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

/**
 * Get a single playlist with songs
 */
function get(id) {
  const playlists = load();
  return playlists.find(p => p.id === id) || null;
}

/**
 * Add a song to a playlist
 */
function addSong(playlistId, song) {
  const playlists = load();
  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist) return { error: '歌单不存在' };
  
  // Prevent duplicates
  const exists = playlist.songs.some(s => s.id == song.id && s.source === (song.source || 'netease'));
  if (exists) return { error: '歌曲已在歌单中' };
  
  playlist.songs.push({
    id: song.id,
    name: song.name || '',
    artist: song.artist || '',
    cover: song.cover || '',
    duration: song.duration || 0,
    source: song.source || 'netease',
    addedAt: Date.now(),
  });
  playlist.updatedAt = Date.now();
  save(playlists);
  return { success: true, playlist };
}

/**
 * Remove a song from a playlist
 */
function removeSong(playlistId, songId) {
  const playlists = load();
  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist) return { error: '歌单不存在' };
  
  playlist.songs = playlist.songs.filter(s => String(s.id) !== String(songId));
  playlist.updatedAt = Date.now();
  save(playlists);
  return { success: true, playlist };
}

/**
 * Delete a playlist
 */
function remove(playlistId) {
  let playlists = load();
  const idx = playlists.findIndex(p => p.id === playlistId);
  if (idx === -1) return { error: '歌单不存在' };
  playlists.splice(idx, 1);
  save(playlists);
  return { success: true };
}

module.exports = { create, list, get, addSong, removeSong, remove };
