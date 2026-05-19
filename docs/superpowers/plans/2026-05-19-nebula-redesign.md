# Nebula Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform MusicWave's dark theme into a Nebula-inspired immersive UI with deep space gradients, neon glow, glassmorphism cards, and fluid animations.

**Architecture:** Pure CSS redesign with minimal JS additions. Replace `:root` CSS variables for the color system, add Google Fonts link for Plus Jakarta Sans, add a Canvas-based stardust particle background, and overlay new component styles. Light theme gets a complementary adaptation.

**Tech Stack:** CSS custom properties, Canvas 2D API, Google Fonts, Express static server

---

## File Map

| File | Status | Change Summary |
|------|--------|---------------|
| `backend/public/index.html` | Modify | Google Fonts (Plus Jakarta Sans + Inter), particle canvas element, shimmer skeleton markup |
| `backend/public/css/style.css` | Modify | Replace color tokens, add glass/glow utilities, restyle sidebar/cards/player/track-list, add shimmer/entrance animations |
| `backend/public/js/app.js` | Modify | Add stardust particle canvas initialization on DOMContentLoaded |
| `backend/public/css/baidu.css` | Modify (minor) | Update body font to match |
| `docs/superpowers/specs/2026-05-19-nebula-redesign.md` | Reference | Design spec |

No new files created. All changes are modifications to existing files.

---

### Task 1: CSS Color System — Dark Theme (Nebula)

**Files:**
- Modify: `backend/public/css/style.css:2-124`

Replace the `:root` dark-theme color tokens with the Nebula palette. Keep all existing variable names for backward compatibility — only change values.

- [ ] **Replace `:root` color values**

Old (`:root` block, lines 2-75):
```css
:root {
  /* Background */
  --bg-primary: #0a0a0a;
  --bg-secondary: #111111;
  /* ... existing values ... */
}
```

New:
```css
:root {
  /* Background */
  --bg-primary: #0a0a1a;
  --bg-secondary: #0d0d20;
  --bg-tertiary: #12122a;
  --bg-elevated: #0f0f24;
  --bg-card: rgba(255,255,255,0.04);
  --bg-hover: rgba(255,255,255,0.08);
  --menu-bg: rgba(15,15,36,0.95);

  /* Text */
  --text-primary: rgba(255,255,255,0.92);
  --text-secondary: rgba(255,255,255,0.55);
  --text-tertiary: rgba(255,255,255,0.35);
  --text-muted: rgba(255,255,255,0.2);

  /* Accent — Nebula cyan/purple/green */
  --accent-color: #00d4ff;
  --accent-hover: #33ddff;
  --accent-glow: rgba(0,212,255,0.25);
  --accent-red: #ff4757;
  --accent-orange: #ffa502;
  --accent-blue: #3b82f6;
  --accent-purple: #a855f7;

  /* Player */
  --player-bg: rgba(10,10,26,0.95);

  /* Borders */
  --border-color: rgba(255,255,255,0.08);
  --border-light: rgba(255,255,255,0.05);

  /* Sizing (same) */
  --sidebar-width: 240px;
  --player-height: 90px;
  --lyrics-width: 360px;
  --header-height: 56px;

  /* Shape */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 50%;

  /* Motion */
  --transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --transition-slow: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --transition-spring: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Shadows — glow-forward */
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.6);
  --shadow-glow: 0 0 24px var(--accent-glow);
  --shadow-glow-strong: 0 0 40px rgba(0,212,255,0.15);

  /* Glass utilities */
  --glass-bg: rgba(255,255,255,0.04);
  --glass-border: rgba(255,255,255,0.06);
  --glass-border-active: rgba(0,212,255,0.15);
  --glass-blur: 12px;

  --player-bar-bg: rgba(10,10,26,0.88);
  --modal-bg: rgba(10,10,26,0.92);
  --fullscreen-bg: rgba(0,0,0,0.92);
  --top-bar-start: rgba(10,10,26,0.9);
  --content-gradient-top: transparent;
  --hero-gradient: linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(168,85,247,0.06) 40%, rgba(13,27,42,1) 100%);
  --hover-bg: rgba(255,255,255,0.04);
  --hover-bg-strong: rgba(255,255,255,0.08);
  --hover-bg-subtle: rgba(255,255,255,0.02);
  --hover-bg-track: rgba(255,255,255,0.04);
  --playing-bg: rgba(0,212,255,0.08);
  --card-hover-border: rgba(0,212,255,0.15);
  --card-play-shadow: 0 0 30px rgba(0,212,255,0.1);
  --scrollbar-thumb: rgba(255,255,255,0.1);
  --shortcuts-overlay: rgba(0,0,0,0.4);
}
```

- [ ] **Update body background**

Add body background gradient:

Old:
```css
body {
  background: var(--bg-primary);
```

New:
```css
body {
  background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 40%, #0d1b2a 100%);
```

- [ ] **Validate no regressions**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
Expected: `200`

- [ ] **Commit**

```bash
git add backend/public/css/style.css
git commit -m "refactor: Nebula dark-theme color system with cyan accent, glass tokens, gradient background"
```

---

### Task 2: Light Theme Adaptation

**Files:**
- Modify: `backend/public/css/style.css:77-123`

Update the `[data-theme="light"]` block to complement the Nebula dark theme. Light surfaces, cyan accent remains, softer glass.

- [ ] **Replace `[data-theme="light"]` color values**

```css
[data-theme="light"] {
  --bg-primary: #f0f2f8;
  --bg-secondary: #ffffff;
  --bg-tertiary: #e4e7f0;
  --bg-elevated: #f8f9fc;
  --bg-card: rgba(255,255,255,0.7);
  --bg-hover: rgba(0,0,0,0.05);
  --menu-bg: rgba(255,255,255,0.95);

  --text-primary: #1a1a2e;
  --text-secondary: #555577;
  --text-tertiary: #8888aa;
  --text-muted: #bbbbdd;

  --accent-color: #0099cc;
  --accent-hover: #0077aa;
  --accent-glow: rgba(0,153,204,0.12);
  --accent-red: #e74c3c;
  --accent-orange: #d4901a;
  --accent-blue: #3b82f6;
  --accent-purple: #7c3aed;

  --player-bg: rgba(240,242,248,0.95);

  --border-color: rgba(0,0,0,0.08);
  --border-light: rgba(0,0,0,0.04);

  --player-bar-bg: rgba(240,242,248,0.92);
  --modal-bg: rgba(255,255,255,0.95);
  --top-bar-start: rgba(240,242,248,0.92);
  --content-gradient-top: transparent;
  --hero-gradient: linear-gradient(135deg, rgba(0,153,204,0.04) 0%, rgba(124,58,237,0.04) 40%, #f0f2f8 100%);
  --hover-bg: rgba(0,0,0,0.03);
  --hover-bg-strong: rgba(0,0,0,0.05);
  --hover-bg-subtle: rgba(0,0,0,0.01);
  --hover-bg-track: rgba(0,0,0,0.02);
  --playing-bg: rgba(0,153,204,0.06);
  --card-hover-border: rgba(0,153,204,0.12);
  --card-play-shadow: 0 4px 20px rgba(0,153,204,0.1);
  --scrollbar-thumb: rgba(0,0,0,0.1);
  --shortcuts-overlay: rgba(0,0,0,0.15);

  --shadow-sm: 0 2px 8px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.06);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.08);
  --shadow-glow: 0 0 20px var(--accent-glow);
  --shadow-glow-strong: 0 0 30px rgba(0,153,204,0.08);
}
```

- [ ] **Commit**

```bash
git add backend/public/css/style.css
git commit -m "refactor: light theme adaptation for Nebula color system"
```

---

### Task 3: Typography — Plus Jakarta Sans

**Files:**
- Modify: `backend/public/index.html:13-15`
- Modify: `backend/public/js/app.js` (any dynamic font references)
- Modify: `backend/public/css/baidu.css:5` (body font)

- [ ] **Replace Google Fonts link in index.html**

Old:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

New:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

This loads Plus Jakarta Sans for headings and Inter for body/UI as fallback.

- [ ] **Update body font-family in style.css** (find existing body rule)

Old:
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

New:
```css
font-family: 'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

- [ ] **Update font-family in baidu.css:5**

Old:
```css
font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
```

New:
```css
font-family: 'Inter', 'Plus Jakarta Sans', -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
```

- [ ] **Add logo gradient text style** (find `.sidebar-logo` or equivalent)

Add:
```css
.sidebar-logo {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 700;
}
.sidebar-logo .logo-icon {
  /* icon stays as-is */
}
.sidebar-logo span:last-child {
  background: linear-gradient(90deg, var(--accent-color), var(--accent-purple));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

- [ ] **Commit**

```bash
git add backend/public/index.html backend/public/css/style.css backend/public/css/baidu.css
git commit -m "feat: Plus Jakarta Sans typography, logo gradient text, body font update"
```

---

### Task 4: Body Background & Gradient Overlay

**Files:**
- Modify: `backend/public/css/style.css`

- [ ] **Add body background gradient and overlay**

Update body (find the existing `body` rule):
```css
body {
  background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 40%, #0d1b2a 100%);
  background-attachment: fixed;
  min-height: 100vh;
}
```

- [ ] **Update `.app-layout` or main container to have matching background**

Ensure `.app-layout` doesn't override with a solid color. If it has `background`, remove it or make it transparent.

- [ ] **Update `.content-scroll` to have transparent background**

Find the `.content-scroll` or main content area and ensure it has `background: transparent`.

- [ ] **Commit**

```bash
git add backend/public/css/style.css
git commit -m "feat: deep space gradient background, remove opaque container backgrounds"
```

---

### Task 5: Sidebar Navigation Restyling

**Files:**
- Modify: `backend/public/css/style.css` (sidebar rules)

- [ ] **Update sidebar background to glass**

Find `.sidebar` rule. Change background to glass:
```css
.sidebar {
  background: var(--menu-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-right: 1px solid var(--border-light);
}
```

- [ ] **Update nav item states**

Find the `.nav-item` base styles and add hover/active states:
```css
.nav-item {
  border-radius: var(--radius-md);
  transition: var(--transition);
  cursor: pointer;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text-secondary);
  position: relative;
}

.nav-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
  border: 1px dashed var(--glass-border-active);
}

.nav-item.active {
  background: rgba(0,212,255,0.08);
  color: var(--accent-color);
  font-weight: 600;
  border: 1px solid var(--glass-border-active);
  box-shadow: inset 0 0 20px rgba(0,212,255,0.04);
}
```

- [ ] **Add active left border indicator**

Inside `.nav-item.active`:
```css
.nav-item.active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--accent-color);
  border-radius: 0 3px 3px 0;
  box-shadow: 0 0 10px var(--accent-glow);
}
```

- [ ] **Commit**

```bash
git add backend/public/css/style.css
git commit -m "feat: glass sidebar with glowing nav item states and active indicator"
```

---

### Task 6: Card Component Restyling

**Files:**
- Modify: `backend/public/css/style.css` (`.card` rules)

- [ ] **Update card base styles**

Find `.card` rule. Apply glass styling:
```css
.card {
  background: var(--bg-card);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: var(--transition-spring);
  cursor: pointer;
  min-width: 0;
}

.card:hover {
  transform: translateY(-4px);
  border-color: var(--card-hover-border);
  box-shadow: 0 12px 40px rgba(0,212,255,0.08);
}

.card-cover {
  border-radius: var(--radius-md);
}
```

- [ ] **Add playing state for active card**

Add `.card.playing` styles:
```css
.card.playing {
  border-color: var(--accent-color);
  box-shadow: 0 0 30px var(--accent-glow), inset 0 0 30px rgba(0,212,255,0.02);
}
.card.playing .card-title {
  color: var(--accent-color);
}
```

- [ ] **Add shimmer loading state**

Add skeleton loading styles:
```css
/* Shimmer loading */
.shimmer {
  background: rgba(255,255,255,0.03);
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
}
.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Loading skeleton for cards */
.card-skeleton {
  background: rgba(255,255,255,0.03);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.card-skeleton .shimmer-img {
  width: 100%;
  aspect-ratio: 1;
  background: rgba(255,255,255,0.03);
  position: relative;
  overflow: hidden;
}
.card-skeleton .shimmer-text {
  height: 12px;
  margin: 10px;
  background: rgba(255,255,255,0.03);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}
.card-skeleton .shimmer-text-short {
  width: 60%;
  height: 8px;
  margin: 0 10px 10px;
  background: rgba(255,255,255,0.03);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}
.card-skeleton .shimmer-img::after,
.card-skeleton .shimmer-text::after,
.card-skeleton .shimmer-text-short::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
  animation: shimmer 1.5s infinite;
}
```

- [ ] **Add entrance stagger animation**

```css
/* Card entrance animation */
.card-entrance {
  animation: cardFadeIn 0.4s ease-out both;
}
@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.card-entrance:nth-child(1) { animation-delay: 0s; }
.card-entrance:nth-child(2) { animation-delay: 0.06s; }
.card-entrance:nth-child(3) { animation-delay: 0.12s; }
.card-entrance:nth-child(4) { animation-delay: 0.18s; }
.card-entrance:nth-child(5) { animation-delay: 0.24s; }
.card-entrance:nth-child(6) { animation-delay: 0.30s; }
.card-entrance:nth-child(7) { animation-delay: 0.36s; }
.card-entrance:nth-child(8) { animation-delay: 0.42s; }
```

- [ ] **Add playing audio bars indicator**

```css
/* Audio bars overlay for playing cards */
.card-playing-indicator {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 16px;
}
.card-playing-indicator span {
  width: 3px;
  background: var(--accent-color);
  border-radius: 2px;
  animation: audioBar 0.8s ease infinite alternate;
}
.card-playing-indicator span:nth-child(1) { height: 100%; }
.card-playing-indicator span:nth-child(2) { height: 60%; animation-delay: 0.15s; }
.card-playing-indicator span:nth-child(3) { height: 80%; animation-delay: 0.3s; }
.card-playing-indicator span:nth-child(4) { height: 45%; animation-delay: 0.45s; }

@keyframes audioBar {
  0% { height: 20%; }
  100% { height: 100%; }
}
```

- [ ] **Commit**

```bash
git add backend/public/css/style.css
git commit -m "feat: glass cards with hover lift, playing glow, shimmer skeleton, entrance stagger, audio bars"
```

---

### Task 7: Player Bar Redesign

**Files:**
- Modify: `backend/public/css/style.css` (`.player-bar`, `.player-controls`, `.player-progress`, `.player-btn*`)

- [ ] **Update player bar base style**

Find `.player-bar` rule. Apply glass effect:
```css
.player-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: var(--player-height);
  background: var(--player-bar-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  padding: 0 24px 18px;
  z-index: 100;
  gap: 16px;
}
```

- [ ] **Update cover art rotation + glow**

Find `.player-cover`:
```css
.player-cover {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--bg-tertiary);
  border: 2px solid rgba(255,255,255,0.08);
  box-shadow: 0 0 20px rgba(0,212,255,0.1);
  transition: transform 0.3s ease;
}
.player-cover.playing {
  animation: coverSpin 8s linear infinite;
  box-shadow: 0 0 30px var(--accent-glow);
}
```

- [ ] **Update play button with gradient + glow**

Find `.player-btn-main`:
```css
.player-btn-main {
  font-size: 22px;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--accent-color), var(--accent-purple));
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  box-shadow: 0 4px 20px rgba(0,212,255,0.3);
}
.player-btn-main:hover {
  transform: scale(1.06);
  box-shadow: 0 6px 28px rgba(0,212,255,0.4);
}
```

- [ ] **Update progress bar with gradient fill**

Find `.progress-fill`:
```css
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--accent-purple));
  border-radius: 2px;
  position: relative;
  transition: width 0.3s ease;
}
.progress-bar:hover .progress-fill {
  background: linear-gradient(90deg, var(--accent-hover), var(--accent-purple));
}
```

- [ ] **Update progress thumb (glow dot)**

Find `.progress-thumb`:
```css
.progress-thumb {
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 12px var(--accent-glow);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}
.progress-bar:hover .progress-thumb {
  opacity: 1;
}
```

- [ ] **Update volume bar fill**

Find `.volume-fill`:
```css
.volume-fill {
  height: 100%;
  background: var(--accent-color);
  border-radius: 2px;
  width: 70%;
  transition: width 0.15s ease;
}
```

- [ ] **Commit**

```bash
git add backend/public/css/style.css
git commit -m "feat: glass player bar, gradient play button, glowing progress thumb, cyan volume"
```

---

### Task 8: Track List & Playing Indicator

**Files:**
- Modify: `backend/public/css/style.css` (`.track-item` rules)

- [ ] **Update track item states**

Find `.track-item` rules:
```css
.track-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  transition: var(--transition);
  cursor: pointer;
  position: relative;
}
.track-item:hover {
  background: var(--hover-bg-track);
}
/* Playing track */
.track-item.playing {
  background: var(--playing-bg);
  border-left: 3px solid var(--accent-color);
  box-shadow: inset 0 0 20px rgba(0,212,255,0.03);
}
.track-item.playing .track-name {
  color: var(--accent-color);
}
```

- [ ] **Add audio playing animation for current track**

```css
.track-playing-icon {
  display: inline-flex;
  gap: 2px;
  align-items: flex-end;
  height: 14px;
  margin-right: 4px;
}
.track-playing-icon span {
  width: 2px;
  background: var(--accent-color);
  border-radius: 1px;
  animation: trackBar 0.6s ease infinite alternate;
}
.track-playing-icon span:nth-child(1) { height: 100%; }
.track-playing-icon span:nth-child(2) { height: 50%; animation-delay: 0.15s; }
.track-playing-icon span:nth-child(3) { height: 70%; animation-delay: 0.3s; }

@keyframes trackBar {
  0% { height: 20%; }
  100% { height: 100%; }
}
```

- [ ] **Commit**

```bash
git add backend/public/css/style.css
git commit -m "feat: track list with playing highlight, left glow border, animated audio bars"
```

---

### Task 9: Global Animations & Transitions

**Files:**
- Modify: `backend/public/css/style.css` (add keyframes and utility classes)

- [ ] **Add page transition animation**

```css
/* Page content transitions */
.content-scroll > * {
  animation: pageEnter 0.25s ease-out;
}
@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Add like/heart pop animation**

```css
@keyframes heartPop {
  0% { transform: scale(1); }
  30% { transform: scale(1.3); }
  60% { transform: scale(0.95); }
  100% { transform: scale(1); }
}
.heart-pop {
  animation: heartPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

- [ ] **Add scrollbar styling to match theme**

```css
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.15);
}
```

- [ ] **Add `prefers-reduced-motion` support**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .card:hover {
    transform: none;
  }
}
```

- [ ] **Commit**

```bash
git add backend/public/css/style.css
git commit -m "feat: page enter animation, heart pop, themed scrollbar, reduced-motion support"
```

---

### Task 10: Stardust Particle Background

**Files:**
- Modify: `backend/public/js/app.js` (add particle system init)
- Modify: `backend/public/index.html` (add canvas element)

- [ ] **Add canvas element to index.html**

After `<div class="app-layout">` opening, add:
```html
<canvas id="stardust" style="position:fixed;inset:0;pointer-events:none;z-index:0;"></canvas>
```

- [ ] **Add particle system to app.js**

At the end of `DOMContentLoaded` callback in app.js, add:
```javascript
// ======== Stardust Particle Background ========
(function initStardust() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;
  
  const canvas = document.getElementById('stardust');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  let particles = [];
  let mouseX = 0, mouseY = 0;
  let animId;
  
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  
  function createParticles(count) {
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.15,
      });
    }
  }
  
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (const p of particles) {
      // Mouse influence
      const dx = mouseX - p.x;
      const dy = mouseY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 200) {
        const force = (200 - dist) / 200 * 0.02;
        p.speedX += dx * force * 0.01;
        p.speedY += dy * force * 0.01;
      }
      
      // Damping
      p.speedX *= 0.99;
      p.speedY *= 0.99;
      
      // Move
      p.x += p.speedX;
      p.y += p.speedY;
      
      // Wrap
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 220, 255, ${p.opacity})`;
      ctx.fill();
    }
    
    animId = requestAnimationFrame(draw);
  }
  
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  
  resize();
  // Desktop: 80-100 particles, mobile: 30
  const isMobile = window.innerWidth < 768;
  createParticles(isMobile ? 30 : 80);
  draw();
})();
```

- [ ] **Make `.app-layout` background transparent and set z-index**

Ensure `.app-layout` and its children (`.sidebar`, `.content-area`) have `z-index: 1` or higher so they sit above the canvas, and their backgrounds are transparent or semi-transparent glass.

- [ ] **Commit**

```bash
git add backend/public/js/app.js backend/public/index.html backend/public/css/style.css
git commit -m "feat: stardust particle background with mouse interaction, glass layer stacking"
```

---

### Task 11: Mobile Adaptation Refinements

**Files:**
- Modify: `backend/public/css/style.css` (media queries at 768px and 480px)

- [ ] **Ensure sidebar overlay uses glass**

At 768px media query:
```css
.sidebar-overlay {
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
```

- [ ] **Update card grid for mobile**

At 480px:
```css
.card-grid {
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.card {
  border-radius: var(--radius-md);
}
.card:hover {
  transform: translateY(-2px); /* reduced lift on mobile */
}
```

- [ ] **Reduce particle count on mobile**

Already handled in Task 10 (isMobile check creates 30 particles on mobile).

- [ ] **Commit**

```bash
git add backend/public/css/style.css
git commit -m "refactor: mobile glass overlay, tighter card grid, reduced hover lift"
```

---

### Task 12: CSS Cleanup & Self-Review

**Files:**
- Modify: `backend/public/css/style.css`

- [ ] **Search for stale colors**

Grep for any remaining `#0a0a0a`, `#111111`, `#1db954` hardcoded values outside comments:
```bash
grep -n '#0a0a0a\|#111111\|#1e1e1e\|#1db954\|#20e05e' backend/public/css/style.css | grep -v '\/\*'
```

Replace any found with the appropriate CSS variable.

- [ ] **Verify all `.card-hover` compatible with new tokens**

Check that `--card-hover-border`, `--card-play-shadow`, `--playing-bg` are used consistently.

- [ ] **Final visual check**

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/24940/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'nebula-final-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'nebula-final-mobile.png', fullPage: true });
  console.log('Screenshots saved');
  await browser.close();
})();
"
```

- [ ] **Commit**

```bash
git add backend/public/css/style.css
git commit -m "chore: CSS cleanup, remove stale colors, final polish"
```
