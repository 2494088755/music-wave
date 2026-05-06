/**
 * Lyrics Parser & Display Module
 * Parses LRC format lyrics and syncs with audio playback
 * Supports click-to-seek on lyric lines
 */
const LyricsManager = {
  currentLyrics: [],
  currentLineIndex: -1,

  /**
   * Parse LRC format lyrics string into timed lines
   * @param {string} lrcText - Raw LRC lyrics text
   * @returns {Array} Array of {time: number (seconds), text: string} sorted by time
   */
  parse(lrcText) {
    if (!lrcText || lrcText.trim() === '') return [];
    
    const lines = lrcText.split('\n');
    const lyrics = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const line of lines) {
      const matches = [...line.matchAll(timeRegex)];
      if (matches.length === 0) continue;

      const text = line.replace(timeRegex, '').trim();
      if (!text) continue;

      for (const match of matches) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        let millis = 0;
        if (match[3]) {
          millis = parseInt(match[3].length === 2 ? match[3] + '0' : match[3]);
        }
        const time = minutes * 60 + seconds + millis / 1000;
        lyrics.push({ time, text });
      }
    }

    lyrics.sort((a, b) => a.time - b.time);
    return lyrics;
  },

  /**
   * Get the current lyric line index based on audio time
   */
  getCurrentLineIndex(time) {
    const lyrics = this.currentLyrics;
    if (lyrics.length === 0) return -1;

    let index = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (time >= lyrics[i].time) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  },

  /**
   * Render lyrics in the lyrics panel with click-to-seek support
   */
  render(lyricsArray) {
    const container = document.getElementById('lyricsContent');
    const fullContainer = document.getElementById('fullscreenLyrics');
    const hasFullscreen = fullContainer && document.getElementById('fullscreenView').classList.contains('active');
    this.currentLyrics = lyricsArray;
    this.currentLineIndex = -1;

    if (!lyricsArray || lyricsArray.length === 0) {
      const placeholder = '<div class="lyric-placeholder">🎵</div><div class="lyric-placeholder">暂无歌词</div>';
      container.innerHTML = placeholder;
      if (hasFullscreen) {
        fullContainer.innerHTML = '<div class="fullscreen-lyrics-placeholder">🎵 暂无歌词</div>';
      }
      return;
    }

    const html = lyricsArray.map((line, i) => {
      return `<div class="lyric-line" data-index="${i}" data-time="${line.time}">${escapeHtml(line.text)}</div>`;
    }).join('');
    
    container.innerHTML = html;
    if (hasFullscreen) {
      fullContainer.innerHTML = html;
    }
    
    // Add click-to-seek listener to both containers
    const addClickSeek = (el) => {
      el.addEventListener('click', (e) => {
        const line = e.target.closest('.lyric-line');
        if (!line) return;
        const time = parseFloat(line.dataset.time);
        if (!isNaN(time) && Player && Player.audio) {
          Player.audio.currentTime = time;
        }
      });
    };
    addClickSeek(container);
    if (hasFullscreen) addClickSeek(fullContainer);
  },

  /**
   * Update active lyric line based on current playback time
   */
  update(time) {
    const newIndex = this.getCurrentLineIndex(time);
    if (newIndex === this.currentLineIndex) return;

    this.currentLineIndex = newIndex;
    const lines = document.querySelectorAll('.lyric-line');
    
    // Batch class updates for performance
    lines.forEach((line, i) => {
      if (i === newIndex) {
        line.classList.add('active');
        line.classList.remove('prev');
      } else if (i === newIndex - 1) {
        line.classList.remove('active');
        line.classList.add('prev');
      } else {
        line.classList.remove('active', 'prev');
      }
    });

    // Also update fullscreen lyrics
    const fullLyrics = document.querySelectorAll('#fullscreenLyrics .lyric-line');
    if (fullLyrics.length > 0) {
      fullLyrics.forEach((line, i) => {
        if (i === newIndex) {
          line.classList.add('active');
          line.classList.remove('prev');
        } else if (i === newIndex - 1) {
          line.classList.remove('active');
          line.classList.add('prev');
        } else {
          line.classList.remove('active', 'prev');
        }
      });
      if (newIndex >= 0 && fullLyrics[newIndex]) {
        fullLyrics[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // Smooth scroll to active line
    if (newIndex >= 0 && lines[newIndex]) {
      lines[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  /**
   * Reset lyrics display
   */
  clear() {
    this.currentLyrics = [];
    this.currentLineIndex = -1;
    document.getElementById('lyricsContent').innerHTML = `
      <div class="lyric-placeholder">🎵</div>
      <div class="lyric-placeholder">选择一首歌曲开始播放</div>
    `;
  }
};

function parseLyricResponse(lrc) {
  if (!lrc) return [];
  if (Array.isArray(lrc)) return lrc;
  if (typeof lrc === 'string') {
    return LyricsManager.parse(lrc);
  }
  return [];
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
