// Internationalisation: loads i18n/<lang>.json, translates keys, handles plurals.
//
// Translation values can be:
//   "Plain text with {placeholders}"
//   { "one": "{n} player", "few": "...", "many": "...", "other": "{n} players" }
//   (plural forms follow Intl.PluralRules categories; "other" is required)

import { ROOT_URL } from './env.js';

const cfg = window.PUNKTO_CONFIG;
export const LANGS = cfg.languages;
const FALLBACK = LANGS[0];

// Native language names for the language switcher.
export const LANG_NAMES = {
  en: 'English', de: 'Deutsch', ru: 'Русский', es: 'Español', fr: 'Français',
  it: 'Italiano', pt: 'Português', pl: 'Polski', uk: 'Українська', tr: 'Türkçe',
  cs: 'Čeština', nl: 'Nederlands'
};

let lang = FALLBACK;
let dict = {};
let fallbackDict = {};
let plural = new Intl.PluralRules(FALLBACK);
const loaded = {};

async function fetchDict(code) {
  if (loaded[code]) return loaded[code];
  const res = await fetch(new URL(`i18n/${code}.json`, ROOT_URL));
  if (!res.ok) throw new Error(`i18n ${code}: ${res.status}`);
  loaded[code] = await res.json();
  return loaded[code];
}

export function getLang() { return lang; }

export async function setLang(code) {
  if (!LANGS.includes(code)) code = FALLBACK;
  try {
    fallbackDict = await fetchDict(FALLBACK);
    dict = code === FALLBACK ? fallbackDict : await fetchDict(code);
    lang = code;
  } catch (e) {
    console.warn(e);
    dict = fallbackDict;
    lang = FALLBACK;
  }
  plural = new Intl.PluralRules(lang);
  document.documentElement.lang = lang;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.content = t('meta.description');
  return lang;
}

/** Pick the start language: language page URL > saved choice > browser > fallback. */
export function detectLang(saved) {
  const pageLang = document.documentElement.dataset.pageLang;
  if (pageLang && pageLang !== FALLBACK && LANGS.includes(pageLang)) return pageLang;
  if (saved && LANGS.includes(saved)) return saved;
  for (const l of navigator.languages || [navigator.language || '']) {
    const code = String(l).toLowerCase().split('-')[0];
    if (LANGS.includes(code)) return code;
  }
  return FALLBACK;
}

function lookup(d, key) {
  let v = d;
  for (const part of key.split('.')) {
    if (v == null) return undefined;
    v = v[part];
  }
  return v;
}

/** Translate a key. vars.n selects the plural form. */
export function t(key, vars = {}) {
  let v = lookup(dict, key);
  if (v == null) v = lookup(fallbackDict, key);
  if (v == null) return key;
  if (typeof v === 'object') {
    const n = Number(vars.n ?? 0);
    v = v[plural.select(n)] ?? v.other ?? '';
  }
  return String(v).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}

/** Locale-aware number/date helpers. */
export const fmtNum = n => new Intl.NumberFormat(lang).format(n);
export const fmtDate = ts => new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(ts);
export function fmtAgo(ts) {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const s = (ts - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(Math.round(s), 'second');
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(ts);
}

/** URL of the language landing page (used to keep the address bar in sync). */
export function langUrl(code) {
  return new URL(code === FALLBACK ? './' : `${code}/`, ROOT_URL);
}
