// Persistence (localStorage) + live sync between tabs/windows (BroadcastChannel).
//
// Keys:
//   punkto:index        → ["boardId", ...]
//   punkto:board:<id>   → full board JSON (one key per board keeps writes small)
//   punkto:settings     → { theme, lang }
//   punkto:license      → premium license (see premium.js)
import { normalizeBoard } from './model.js';

const PREFIX = 'punkto:';
const chan = 'BroadcastChannel' in window ? new BroadcastChannel('punkto') : null;
const listeners = new Set();
let errorHandler = (e) => console.error(e);

export function onStorageError(fn) { errorHandler = fn; }

/** Subscribe to changes made in OTHER tabs/windows: fn({ type, id }). */
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(msg) { listeners.forEach(fn => { try { fn(msg); } catch (e) { console.error(e); } }); }

if (chan) chan.onmessage = (e) => emit(e.data);
else {
  // Fallback for browsers without BroadcastChannel: the storage event.
  window.addEventListener('storage', (e) => {
    if (!e.key?.startsWith(PREFIX)) return;
    if (e.key.startsWith(PREFIX + 'board:')) emit({ type: 'board', id: e.key.slice(PREFIX.length + 6) });
    else if (e.key === PREFIX + 'settings') emit({ type: 'settings' });
    else if (e.key === PREFIX + 'license') emit({ type: 'license' });
    else emit({ type: 'index' });
  });
}

export function broadcast(msg) { chan?.postMessage(msg); }

function read(key, fallback = null) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    errorHandler(e);
    return false;
  }
}

export function readRaw(key, fallback) { return read(key, fallback); }
export function writeRaw(key, value) { return write(key, value); }
export function removeRaw(key) { localStorage.removeItem(PREFIX + key); }

/* ----------------------------------------------------------------- boards */

function getIndex() { return read('index', []); }
function setIndex(ids) { write('index', [...new Set(ids)]); }

export function listBoards() {
  return getIndex().map(getBoard).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getBoard(id) {
  const b = read('board:' + id);
  return b ? normalizeBoard(b) : null;
}

/** Save a board and notify other windows. Returns false if storage is full. */
export function saveBoard(board, { touch = true } = {}) {
  if (touch) board.updatedAt = Date.now();
  if (!write('board:' + board.id, board)) return false;
  const idx = getIndex();
  if (!idx.includes(board.id)) setIndex([board.id, ...idx]);
  broadcast({ type: 'board', id: board.id });
  return true;
}

export function deleteBoard(id) {
  localStorage.removeItem(PREFIX + 'board:' + id);
  setIndex(getIndex().filter(x => x !== id));
  broadcast({ type: 'board', id, deleted: true });
}

/* --------------------------------------------------------------- settings */

export function getSettings() {
  return { theme: 'auto', lang: null, ...read('settings', {}) };
}
export function setSettings(patch) {
  write('settings', { ...getSettings(), ...patch });
  broadcast({ type: 'settings' });
}

/* -------------------------------------------------------------- utilities */

/** Approximate bytes used by Punkto in localStorage (UTF-16 → 2 bytes/char). */
export function storageUsage() {
  let chars = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(PREFIX)) chars += k.length + (localStorage.getItem(k) || '').length;
  }
  return chars * 2;
}

/** Remove every Punkto key (boards, settings, license). */
export function wipeAll() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
  broadcast({ type: 'index' });
}
