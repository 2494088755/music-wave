# MusicWave Nebula Redesign

**Date:** 2026-05-19
**Status:** Approved for implementation
**Direction:** Nebula (星云) — deep space, neon glow, glassmorphism

---

## Design System

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-deep` | `#0a0a1a` | Deepest background |
| `--bg-gradient` | `linear-gradient(135deg, #0a0a1a, #1a0a2e, #0d1b2a)` | Body background |
| `--accent-cyan` | `#00d4ff` | Primary accent, active states, links |
| `--accent-purple` | `#a855f7` | Secondary accent, gradients |
| `--accent-green` | `#22c55e` | Tertiary accent, success states |
| `--glass-bg` | `rgba(255,255,255,0.04)` | Card/surface background |
| `--glass-border` | `rgba(255,255,255,0.06)` | Subtle borders |
| `--glass-border-active` | `rgba(0,212,255,0.12)` | Active/hover borders |
| `--text-primary` | `rgba(255,255,255,0.9)` | Primary text |
| `--text-secondary` | `rgba(255,255,255,0.45)` | Secondary text |
| `--text-tertiary` | `rgba(255,255,255,0.3)` | Placeholder/meta text |
| `--divider` | `rgba(255,255,255,0.06)` | Separators |

### Typography

- **Font:** Plus Jakarta Sans (headings + body via Google Fonts)
- **Scale:** 12 / 14 / 16 / 18 / 24 / 32 px
- **Weights:** Regular 400, Medium 500, SemiBold 600, Bold 700
- **Line height:** Body 1.6, Headings 1.2

### Key Effects

1. **Stardust particle background** — Canvas with 80-100 particles (desktop) / 30 (mobile), slow drift, mouse-reactive flow direction
2. **Glassmorphism cards** — `background: rgba(255,255,255,0.04)`, `backdrop-filter: blur(12px)`, subtle border, hover lift +4px with glow shadow
3. **Neon glow** — `text-shadow` / `box-shadow` with accent color at `rgba(0,212,255,0.3-0.5)`, enhanced on hover
4. **Gradient text** — Logo and section titles using `background-clip: text` with cyan→purple→green gradient
5. **Shimmer loading** — Skeleton screens with sweeping gradient animation, replacing spinner

---

## Layout Structure

### Desktop (≥1024px)

**Option A — Classic Sidebar (selected)**
- Fixed left sidebar (240px) with glass styling
- Main content scroll area with flexible grid
- Fixed bottom player bar (90px) with glass backdrop
- Responsive breakpoints at 768px and 480px

### Navigation States (Sidebar)

| State | Background | Text Color | Border |
|-------|-----------|------------|--------|
| Default | none | `rgba(255,255,255,0.4)` | none |
| Hover | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.6)` | dashed `rgba(0,212,255,0.15)` |
| Active | `rgba(0,212,255,0.08)` | `#00d4ff` | solid `rgba(0,212,255,0.12)` + glow |

---

## Component Interactions

### Cards (Playlist/Song Cards)

| State | Transform | Shadow | Border |
|-------|-----------|--------|--------|
| Default | none | none | `rgba(255,255,255,0.05)` |
| Hover | translateY(-4px) | `0 12px 40px rgba(0,212,255,0.08)` | `rgba(0,212,255,0.12)` |
| Playing | none | `0 0 30px rgba(0,212,255,0.1)`, inset glow | `rgba(0,212,255,0.2)` |

- Transition: `all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)` (spring-like)
- Playing indicator: animated audio bars over album art

### Player Bar

- Height: 90px desktop, 72px tablet, 64px mobile
- Background: `rgba(255,255,255,0.04)`, `backdrop-filter: blur(20px)`
- Cover art: 40px rotating (8s linear infinite) when playing, with outer glow
- Play button: gradient background (cyan→purple), `box-shadow: 0 4px 20px rgba(0,212,255,0.3)`
- Progress bar: 4px height, gradient fill, hover reveals 12px drag handle
- Volume bar: subtle, hover reveals cyan fill

### Track List

- Current track: highlighted row with cyan left border indicator
- Hover: subtle background change
- Playing: animated equalizer icon

---

## Animation System

| Animation | Duration | Easing | Notes |
|-----------|----------|--------|-------|
| Page transition | 250ms | ease-out | fade + translateY(8→0) |
| Card entrance stagger | 60ms/item | ease-out | opacity 0→1, Y 20→0 |
| Card hover | 300ms | cubic-bezier(0.34,1.56,0.64,1) | spring bounce |
| Like/Heart | 150ms | ease-out | scale 1→1.3→1 |
| Sidebar slide (mobile) | 250ms | ease-out | translateX transition |
| Shimmer loading | 1.5s | linear | infinite sweeping gradient |
| Cover spin | 8s | linear | infinite while playing |
| Stardust particles | continuous | smooth | mouse-reactive flow |

- Respect `prefers-reduced-motion`: disable particle system, reduce transitions to fade only
- Exit animations faster than enter (60% of enter duration)

---

## Mobile Adaptation (<768px)

- Sidebar → slide-in overlay with glass backdrop blur
- Bottom player → mini player with 32px cover, compact controls
- Bottom navigation → iOS-style Tab Bar (发现/搜索/歌单/我的), max 5 items
- Cards → 2-column grid
- Stardust particles → reduced to 30 for performance
- Touch targets → minimum 44×44px
- Safe area → respect notch and home indicator

---

## Accessibility

- All interactive elements have visible focus rings (2px, cyan)
- Icon-only buttons have `aria-label`
- Color contrast: text meets 4.5:1 minimum
- Reduced motion supported via `prefers-reduced-motion`
- Form labels properly associated with inputs
- Keyboard navigation preserved

---

## Implementation Scope

1. CSS custom properties (color tokens, spacing, typography)
2. Background gradient and stardust particle canvas
3. Sidebar navigation restyling with new states
4. Card component restyling with hover/playing/loading states
5. Player bar redesign with glass effect and glow
6. Track list restyling with active indicator
7. Typography update (Plus Jakarta Sans)
8. Loading states (shimmer skeletons)
9. Mobile adaptation refinements
10. Animation system (transitions, entrances, micro-interactions)
