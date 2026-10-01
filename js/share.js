// Backups: shareable restore links and JSON export/import.
//
// Restore links put the board in the URL *fragment* (#/import/...), which
// browsers never send to any server — the data stays between the devices.
// Logos are left out to keep links short; use JSON export for those.
import { normalizeBoard, uid, uniqueName } from './model.js';
import { ROOT_URL } from './env.js';

const FORMAT = 'punkto';

/* ------------------------------------------------------------ base64url */
function bytesToB64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** Board without images (for links). */
export function stripImages(board) {
  const b = JSON.parse(JSON.stringify(board));
  b.logo = null;
  b.teams?.forEach(t => { t.logo = null; });
  b.winner = null;
  return b;
}

/** Build a restore URL. Compressed with deflate when the browser supports it. */
export async function boardToLink(board) {
  const json = new TextEncoder().encode(JSON.stringify({ f: FORMAT, v: 1, b: stripImages(board) }));
  let payload;
  if ('CompressionStream' in window) payload = 'z' + bytesToB64url(await pipe(json, new CompressionStream('deflate-raw')));
  else payload = 'j' + bytesToB64url(json);
  return new URL('#/import/' + payload, ROOT_URL).href;
}

export async function linkToBoard(payload) {
  const kind = payload[0];
  let bytes = b64urlToBytes(payload.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('bad-link');
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (data.f !== FORMAT || !data.b) throw new Error('bad-link');
  return normalizeBoard(data.b);
}

/* ---------------------------------------------------------- JSON files */

export function exportJson(boards) {
  return JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), boards }, null, 1);
}

/** Parse an export file → array of normalised boards. Accepts a single board too. */
export function parseImport(text) {
  const data = JSON.parse(text);
  let list;
  if (data && data.format === FORMAT && Array.isArray(data.boards)) list = data.boards;
  else if (data && data.mode && (data.players || data.teams)) list = [data];
  else throw new Error('bad-file');
  return list.map(normalizeBoard).filter(Boolean);
}

/**
 * Make an imported board fit in: a fresh id if the id exists, and a unique
 * title ("Name (2)") if another board already uses the name.
 */
export function prepareImported(board, existingIds, existingTitles = new Set()) {
  if (existingIds.has(board.id)) board.id = uid();
  board.title = uniqueName(board.title || 'Punkto', existingTitles);
  board.winner = null;
  return board;
}

export function safeFilename(s) {
  return (String(s).normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'board').toLowerCase();
}
