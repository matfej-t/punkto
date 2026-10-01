// Board data model and game logic (pure functions, no DOM).
//
// Leaderboard board:
//   players: [{ id, name, scores: [round1, round2, ...] }]
//   round: index of the current round, roundCount: number of rounds
// Scoreboard board:
//   teams: [{ id, name, logo, players: [{ id, name }] }]  (always 2)
//   events: [{ id, teamId, playerId, points, t (match clock ms|null), at }]
//   clock: { enabled, running, startedAt, elapsed }

export const MODES = ['leaderboard', 'scoreboard'];
export const HISTORY_LIMIT = 200;
/** Default point buttons for new boards of either type: "+1 +3" and "−1". */
export const DEFAULT_STEPS = [1, 3];
export const DEFAULT_MINUS = [1];

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 12);
}

export function newPlayer(name) {
  return { id: uid(), name: String(name).trim().slice(0, 60), scores: [] };
}

export function newTeam(name) {
  return { id: uid(), name, logo: null, players: [] };
}

export function newBoard(mode, title, steps = null, minus = null) {
  const now = Date.now();
  const b = {
    id: uid(), v: 1, mode, title: title.slice(0, 80), createdAt: now, updatedAt: now,
    logo: null, history: [], winner: null,
    minus: [...DEFAULT_MINUS] // subtract buttons (stored as positive amounts)
  };
  if (mode === 'leaderboard') {
    Object.assign(b, { players: [], round: 0, roundCount: 1, steps: [...DEFAULT_STEPS], showRounds: false });
  } else {
    Object.assign(b, {
      teams: [newTeam('Home'), newTeam('Away')], events: [], steps: [...DEFAULT_STEPS],
      clock: { enabled: false, running: false, startedAt: null, elapsed: 0 }
    });
  }
  if (steps?.length) b.steps = steps;
  if (minus?.length) b.minus = minus;
  return b;
}

/** Fill in missing fields so older/imported data never crashes the UI. */
export function normalizeBoard(b) {
  if (!b || typeof b !== 'object') return null;
  if (!MODES.includes(b.mode)) b.mode = 'leaderboard';
  const base = newBoard(b.mode, String(b.title ?? 'Punkto'));
  for (const k of Object.keys(base)) if (b[k] === undefined) b[k] = base[k];
  b.title = String(b.title).slice(0, 80);
  // Removed features: colour palettes, custom colours, player photos, manual order.
  delete b.palette;
  delete b.custom;
  delete b.sortControl; // the ranking is always sorted by points
  if (!Array.isArray(b.history)) b.history = [];
  if (!Array.isArray(b.steps) || !b.steps.length) b.steps = base.steps;
  if (!Array.isArray(b.minus) || !b.minus.length) b.minus = base.minus;
  if (b.mode === 'leaderboard') {
    if (!Array.isArray(b.players)) b.players = [];
    b.players = b.players.filter(p => p && typeof p === 'object').map(p => ({
      id: String(p.id || uid()), name: String(p.name ?? '').slice(0, 60),
      scores: Array.isArray(p.scores) ? p.scores.map(n => Number(n) || 0) : [Number(p.score) || 0]
    }));
    b.roundCount = Math.max(1, Math.floor(b.roundCount) || 1);
    b.round = Math.min(Math.max(0, Math.floor(b.round) || 0), b.roundCount - 1);
  } else {
    if (!Array.isArray(b.teams) || b.teams.length !== 2) b.teams = base.teams;
    b.teams.forEach(t => {
      t.id = String(t.id || uid());
      t.name = String(t.name ?? '').slice(0, 60);
      delete t.color;
      if (!Array.isArray(t.players)) t.players = [];
      t.players = t.players.map(p => ({ id: String(p.id || uid()), name: String(p.name ?? '').slice(0, 60) }));
      if (typeof t.logo !== 'string') t.logo = null;
    });
    if (!Array.isArray(b.events)) b.events = [];
    b.events = b.events.filter(e => e && b.teams.some(t => t.id === e.teamId));
    if (!b.clock || typeof b.clock !== 'object') b.clock = base.clock;
  }
  return b;
}

/* ------------------------------------------------------------------ names */

/** Comparable form of a name: trimmed, single spaces, case-insensitive. */
export const normName = s => String(s ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/**
 * Every name used inside one board: players (leaderboard), or team names plus
 * all squad players (scoreboard). All of them share one namespace.
 */
export function namesInBoard(board, exceptId = null) {
  const items = board.mode === 'leaderboard'
    ? board.players
    : [...board.teams, ...board.teams.flatMap(tm => tm.players)];
  return new Set(items.filter(x => x.id !== exceptId).map(x => normName(x.name)));
}

/** First of "Name", "Name (2)", "Name (3)" … that is not in `taken` (a Set of normName values). */
export function uniqueName(name, taken) {
  const base = String(name).trim().replace(/\s+/g, ' ');
  if (!taken.has(normName(base))) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})`;
    if (!taken.has(normName(candidate))) return candidate;
  }
}

/* ------------------------------------------------------------ leaderboard */

export const playerTotal = p => p.scores.reduce((a, n) => a + (Number(n) || 0), 0);

/** Sort by total (desc) with standard competition ranking (1, 1, 3). Stable for ties. */
export function rankPlayers(players) {
  const rows = players.map((p, i) => ({ player: p, total: playerTotal(p), i }));
  rows.sort((a, b) => b.total - a.total || a.i - b.i);
  rows.forEach((r, i) => { r.rank = i > 0 && r.total === rows[i - 1].total ? rows[i - 1].rank : i + 1; });
  return rows;
}

export function addPoints(board, playerId, delta) {
  const p = board.players.find(x => x.id === playerId);
  if (!p) return;
  while (p.scores.length <= board.round) p.scores.push(0);
  p.scores[board.round] = (Number(p.scores[board.round]) || 0) + delta;
}

export function setRoundScore(board, playerId, round, value) {
  const p = board.players.find(x => x.id === playerId);
  if (!p) return;
  while (p.scores.length <= round) p.scores.push(0);
  p.scores[round] = Number(value) || 0;
}

export function nextRound(board) {
  board.round += 1;
  if (board.round >= board.roundCount) board.roundCount = board.round + 1;
}

/** Parse "1, 5, 10" into up to 4 unique positive integers. */
export function parseSteps(str) {
  const list = String(str).split(/[\s,;]+/).map(s => Math.abs(Math.round(Number(s)))).filter(n => n > 0 && n <= 10000);
  return [...new Set(list)].slice(0, 4);
}

/* ------------------------------------------------------------- scoreboard */

export const teamScore = (board, teamId) =>
  board.events.reduce((a, e) => a + (e.teamId === teamId ? Number(e.points) || 0 : 0), 0);

export function clockMs(clock) {
  if (!clock) return 0;
  return (clock.elapsed || 0) + (clock.running && clock.startedAt ? Date.now() - clock.startedAt : 0);
}

export function fmtClock(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Match minute like football: 0:00–0:59 → 1'. */
export const minuteOf = ms => Math.floor(ms / 60000) + 1;

export function addGoal(board, teamId, playerId = null, points = 1) {
  const c = board.clock;
  board.events.push({
    id: uid(), teamId, playerId, points,
    t: c?.enabled && (c.running || c.elapsed > 0) ? clockMs(c) : null,
    at: Date.now()
  });
}

export function toggleClock(board) {
  const c = board.clock;
  if (c.running) { c.elapsed = clockMs(c); c.running = false; c.startedAt = null; }
  else { c.running = true; c.startedAt = Date.now(); }
}

export function resetClock(board) {
  Object.assign(board.clock, { running: false, startedAt: null, elapsed: 0 });
}

export function playerName(board, teamId, playerId) {
  return board.teams.find(t => t.id === teamId)?.players.find(p => p.id === playerId)?.name || null;
}

/* --------------------------------------------------------------- sessions */

/** Snapshot of the score state, used for undo. */
export function scoreSnapshot(b) {
  return b.mode === 'leaderboard'
    ? JSON.stringify({ s: b.players.map(p => [p.id, p.scores]), r: b.round, rc: b.roundCount })
    : JSON.stringify({ e: b.events, c: b.clock });
}

export function restoreSnapshot(b, snap) {
  const d = JSON.parse(snap);
  if (b.mode === 'leaderboard') {
    const map = new Map(d.s);
    b.players.forEach(p => { if (map.has(p.id)) p.scores = map.get(p.id); });
    b.round = d.r; b.roundCount = d.rc;
  } else {
    b.events = d.e; b.clock = d.c;
  }
}

export function hasScores(b) {
  return b.mode === 'leaderboard'
    ? b.players.some(p => p.scores.some(n => n)) || b.roundCount > 1
    : b.events.length > 0;
}

/** Finalise the current game: store the result in history and reset scores. */
export function endGame(board) {
  const entry = { id: uid(), endedAt: Date.now(), mode: board.mode, title: board.title };
  if (board.mode === 'leaderboard') {
    entry.roundCount = board.roundCount;
    entry.standings = rankPlayers(board.players).map(r => ({
      id: r.player.id, name: r.player.name, total: r.total, rank: r.rank,
      rounds: Array.from({ length: board.roundCount }, (_, i) => Number(r.player.scores[i]) || 0)
    }));
  } else {
    entry.teams = board.teams.map(t => ({ id: t.id, name: t.name, score: teamScore(board, t.id) }));
    entry.events = board.events.map(e => ({
      teamId: e.teamId, points: e.points, t: e.t,
      player: playerName(board, e.teamId, e.playerId)
    }));
  }
  board.history.unshift(entry);
  board.history.length = Math.min(board.history.length, HISTORY_LIMIT);
  resetScores(board);
  board.winner = entry.id;
  return entry;
}

export function resetScores(board) {
  if (board.mode === 'leaderboard') {
    board.players.forEach(p => { p.scores = []; });
    board.round = 0;
    board.roundCount = 1;
  } else {
    board.events = [];
    resetClock(board);
  }
}

/** Who won a history entry? → { names: [...], tie: bool, draw: bool } */
export function entryWinners(entry) {
  if (entry.mode === 'leaderboard') {
    const top = entry.standings.filter(s => s.rank === 1);
    return { names: top.map(s => s.name), tie: top.length > 1, draw: false };
  }
  const [a, b] = entry.teams;
  if (a.score === b.score) return { names: [a.name, b.name], tie: false, draw: true };
  return { names: [a.score > b.score ? a.name : b.name], tie: false, draw: false };
}

/** Copy a board (new ids for the board itself; players keep theirs). */
export function cloneBoard(board, title) {
  const c = JSON.parse(JSON.stringify(board));
  c.id = uid();
  c.title = title ?? board.title;
  c.createdAt = c.updatedAt = Date.now();
  c.winner = null;
  return c;
}

/** Tiny preview for the home screen: current leader / score line. */
export function boardSummary(b) {
  if (b.mode === 'leaderboard') {
    const r = rankPlayers(b.players)[0];
    return { count: b.players.length, leader: r && r.total !== 0 ? { name: r.player.name, score: r.total } : null };
  }
  return { count: b.teams.reduce((a, t) => a + t.players.length, 0), line: `${teamScore(b, b.teams[0].id)} : ${teamScore(b, b.teams[1].id)}` };
}
