// Day/night mode and colour palettes.
//
// <html data-scheme="light|dark"> is the resolved scheme (system or manual).
// <html data-palette="classroom|pub|sports|minimal|custom"> picks a palette;
// palettes are defined in css/app.css. Custom colours are set as CSS vars.
import { getSettings, setSettings } from './store.js';

export const PALETTES = ['classroom', 'pub', 'sports', 'minimal', 'custom'];

// Swatch colours for the palette picker (accent, secondary) — keep in sync with CSS.
export const PALETTE_SWATCHES = {
  classroom: ['#E8572A', '#2E9C8A', '#FFF7EE'],
  pub: ['#B5651D', '#2F6B4F', '#F7F1E6'],
  sports: ['#1E8E3E', '#D7263D', '#F3F6F2'],
  minimal: ['#1C1C1C', '#8A8A8A', '#FAFAF9']
};

const mq = matchMedia('(prefers-color-scheme: dark)');

export function resolvedScheme() {
  const pref = getSettings().theme;
  if (pref === 'light' || pref === 'dark') return pref;
  return mq.matches ? 'dark' : 'light';
}

export function applyScheme() {
  const s = resolvedScheme();
  document.documentElement.dataset.scheme = s;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || (s === 'dark' ? '#1A1411' : '#FFF7EE');
}

export function initTheme(onChange) {
  applyScheme();
  mq.addEventListener?.('change', () => { applyScheme(); onChange?.(); });
}

/** Header toggle: flips between light and dark (manual). */
export function toggleScheme() {
  setSettings({ theme: resolvedScheme() === 'dark' ? 'light' : 'dark' });
  applyScheme();
}

export function setThemePref(theme) {
  setSettings({ theme });
  applyScheme();
}

/** Readable text colour (black/white) on top of a hex background. */
export function inkFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.4 ? '#1a1a1a' : '#ffffff';
}

/** Apply a board's palette to the whole page (or reset with null). */
export function applyPalette(board) {
  const root = document.documentElement;
  const pal = board && PALETTES.includes(board.palette) ? board.palette : 'classroom';
  root.dataset.palette = pal;
  const props = ['--accent', '--accent-ink', '--accent-2', '--accent-2-ink'];
  if (pal === 'custom' && board?.custom) {
    root.style.setProperty('--accent', board.custom.a);
    root.style.setProperty('--accent-ink', inkFor(board.custom.a));
    root.style.setProperty('--accent-2', board.custom.b);
    root.style.setProperty('--accent-2-ink', inkFor(board.custom.b));
  } else {
    props.forEach(p => root.style.removeProperty(p));
  }
  applyScheme();
}

/** Colour of a scoreboard team (explicit colour or palette accent). */
export function teamColor(board, index) {
  return board.teams[index].color || (index === 0 ? 'var(--accent)' : 'var(--accent-2)');
}
export function teamInk(board, index) {
  const c = board.teams[index].color;
  return c ? inkFor(c) : (index === 0 ? 'var(--accent-ink)' : 'var(--accent-2-ink)');
}
