// Day/night mode.
//
// <html data-scheme="light|dark"> is the resolved scheme (system or manual).
// Colours for both schemes are defined in css/app.css.
import { getSettings, setSettings } from './store.js';

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

/** CSS variables for a scoreboard team: first team uses the accent colour, second the secondary one. */
export function teamVars(index) {
  return index === 0
    ? { '--team': 'var(--accent)', '--team-ink': 'var(--accent-ink)' }
    : { '--team': 'var(--accent-2)', '--team-ink': 'var(--accent-2-ink)' };
}
