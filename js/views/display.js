// Display view: fullscreen, huge, read-only scoreboard for a TV or projector.
// Updates live whenever the control view saves (BroadcastChannel via store).
import { h, avatar, fill } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtNum } from '../i18n.js';
import * as store from '../store.js';
import { rankPlayers, playerTotal, teamScore, clockMs, fmtClock, minuteOf } from '../model.js';
import { applyPalette, teamColor, teamInk, toggleScheme } from '../theme.js';
import { isPremium } from '../premium.js';
import { adSlot } from '../ads.js';
import { confetti } from '../confetti.js';
import { podium, winnerHeadline } from './winner.js';

const cfg = window.PUNKTO_CONFIG;

export function displayView(root, id) {
  document.body.classList.add('is-display');
  let board = store.getBoard(id);
  if (!board) {
    root.append(h('main.page.center', h('h1', { text: t('errors.notFound') }), h('a.btn.btn-primary', { href: '#/', text: t('common.home') })));
    return null;
  }
  applyPalette(board);

  const titleEl = h('div.d-title');
  const metaEl = h('div.d-meta');
  const main = h('main.d-main');
  const overlay = h('div.d-overlay');
  const rows = new Map();     // player id → row element (keyed for animations)
  const prevTotals = new Map();
  let prevTeamScores = null;
  let shownWinner = board.winner; // don't fire confetti for an already-open result
  let tick = null;

  const fsBtn = h('button.btn.icon-btn', { title: t('display.fullscreen') + ' (F)', 'aria-label': t('display.fullscreen'), html: icon('fullscreen'), onclick: toggleFullscreen });
  const controls = h('div.d-controls',
    fsBtn,
    h('button.btn.icon-btn', { title: t('settings.toggleTheme'), 'aria-label': t('settings.toggleTheme'), html: icon('moon'), onclick: toggleScheme }),
    h('button.btn.icon-btn', { title: t('display.close'), 'aria-label': t('display.close'), html: icon('close'), onclick: closeDisplay })
  );

  const foot = h('footer.d-foot');
  const view = h('div.display', h('header.d-top', titleEl, metaEl), main, foot, overlay, controls);
  root.append(view);

  function renderFoot() {
    fill(foot, 
      !isPremium() ? h('a.made-with', { href: cfg.siteUrl, target: '_blank', rel: 'noopener' }, h('span', { text: t('display.madeWith') }), h('strong', { text: ' Punkto' })) : h('span'),
      // Small fixed-size ad unit, bottom-right corner, never near controls.
      adSlot('display')
    );
  }

  /* ---------------------------------------------------------- render */
  function render() {
    board = store.getBoard(id) || board;
    applyPalette(board);
    document.title = `${board.title} · Punkto`;
    fill(titleEl, board.logo ? h('img.d-logo', { src: board.logo, alt: '' }) : null, h('h1', { text: board.title }));
    if (board.mode === 'leaderboard') {
      fill(metaEl, board.roundCount > 1 || board.showRounds ? h('span.d-round', { text: t('lb.roundN', { n: board.round + 1 }) }) : '');
      if (board.showRounds) renderRounds(); else renderLeaderboard();
    } else {
      fill(metaEl);
      renderScoreboard();
    }
    renderWinner();
    syncTick();
  }

  /* ----- leaderboard: keyed rows + FLIP reordering animation ----- */
  function renderLeaderboard() {
    let list = main.querySelector('.d-lb');
    if (!list) { rows.clear(); list = h('ol.d-lb'); main.replaceChildren(list); }
    const ranked = rankPlayers(board.players);
    if (!ranked.length) { main.replaceChildren(h('p.d-empty', { text: t('display.empty') })); rows.clear(); return; }
    const anyScore = ranked.some(r => r.total !== 0);

    // FLIP step 1: remember old positions.
    const first = new Map([...rows].map(([pid, el]) => [pid, el.getBoundingClientRect()]));

    const seen = new Set();
    ranked.forEach((r, i) => {
      const p = r.player;
      seen.add(p.id);
      let row = rows.get(p.id);
      if (!row) {
        row = h('li.d-row', { dataset: { id: p.id } });
        rows.set(p.id, row);
      }
      const roundPts = board.roundCount > 1 ? Number(p.scores[board.round]) || 0 : null;
      row.className = 'd-row' + (anyScore && r.rank <= 3 ? ` medal-${r.rank}` : '');
      fill(row, 
        h('span.d-rank', { text: anyScore ? r.rank : i + 1 }),
        avatar(p.name, p.photo, 'd-avatar'),
        h('span.d-name', { text: p.name || '—' }),
        roundPts ? h('span.d-roundpts', { text: (roundPts > 0 ? '+' : '') + fmtNum(roundPts) }) : null,
        h('span.d-score', { text: fmtNum(r.total) })
      );
      if (list.children[i] !== row) list.insertBefore(row, list.children[i] || null);
      const prev = prevTotals.get(p.id);
      if (prev !== undefined && prev !== r.total) flash(row, r.total - prev);
      prevTotals.set(p.id, r.total);
    });
    for (const [pid, el] of rows) if (!seen.has(pid)) { el.remove(); rows.delete(pid); prevTotals.delete(pid); }

    layout(list, ranked.length);

    // FLIP step 2: animate from old to new positions.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const [pid, el] of rows) {
        const a = first.get(pid);
        if (!a) continue;
        const b = el.getBoundingClientRect();
        const dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    }
  }

  /** Fit all rows on screen: choose columns and row height for the largest text. */
  function layout(list, n) {
    const W = main.clientWidth, H = main.clientHeight;
    let best = { cols: 1, size: 0 };
    for (let cols = 1; cols <= 4; cols++) {
      const perCol = Math.ceil(n / cols);
      const rowH = Math.min(H / perCol, 170);
      const size = Math.min(rowH, (W / cols) / 6.5);
      if (size > best.size + 2) best = { cols, size, perCol, rowH };
    }
    list.style.setProperty('--cols', best.cols);
    list.style.setProperty('--per-col', best.perCol);
    list.style.setProperty('--row-h', Math.floor(best.size) + 'px');
  }

  function flash(row, delta) {
    row.classList.remove('flash');
    void row.offsetWidth; // restart animation
    row.classList.add('flash');
    const f = h('span.d-float', { class: delta < 0 ? 'neg' : '', text: (delta > 0 ? '+' : '') + fmtNum(delta) });
    row.append(f);
    setTimeout(() => f.remove(), 1400);
  }

  /* ----- leaderboard rounds table ----- */
  function renderRounds() {
    rows.clear();
    const ranked = rankPlayers(board.players);
    if (!ranked.length) { main.replaceChildren(h('p.d-empty', { text: t('display.empty') })); return; }
    const MAXR = 12;
    const from = Math.max(0, board.roundCount - MAXR);
    const cols = Array.from({ length: board.roundCount - from }, (_, i) => from + i);
    const table = h('table.d-rounds',
      h('thead', h('tr', h('th'), h('th'), cols.map(i => h('th', { class: i === board.round ? 'current' : '', text: t('lb.roundShort', { n: i + 1 }) })), h('th.total', { text: t('lb.total') }))),
      h('tbody', ranked.map(r => h('tr', { class: r.total !== 0 && r.rank <= 3 ? 'medal-' + r.rank : '' },
        h('td.rk', { text: r.rank }),
        h('td.nm', h('div', avatar(r.player.name, r.player.photo, 'd-avatar'), h('span', { text: r.player.name || '—' }))),
        cols.map(i => h('td', { class: i === board.round ? 'current' : '', text: fmtNum(Number(r.player.scores[i]) || 0) })),
        h('td.total', { text: fmtNum(r.total) })
      )))
    );
    main.replaceChildren(h('div.d-rounds-wrap', table));
    const rowH = Math.min(110, main.clientHeight / (ranked.length + 1.4));
    const colW = main.clientWidth / (cols.length + 4.5);
    table.style.setProperty('--fs', Math.max(12, Math.min(rowH * 0.5, colW * 0.42)) + 'px');
  }

  /* ----- scoreboard ----- */
  function renderScoreboard() {
    rows.clear();
    const scores = board.teams.map(tm => teamScore(board, tm.id));
    const side = (tm, i) => {
      const scorers = new Map();
      board.events.filter(e => e.teamId === tm.id && e.playerId).forEach(e => {
        const name = tm.players.find(p => p.id === e.playerId)?.name;
        if (!name) return;
        if (!scorers.has(name)) scorers.set(name, []);
        scorers.get(name).push(e.t != null ? minuteOf(e.t) + "'" : '');
      });
      return h('div.d-team', { style: { '--team': teamColor(board, i), '--team-ink': teamInk(board, i) } },
        tm.logo ? h('img.d-team-logo', { src: tm.logo, alt: '' }) : h('span.d-team-logo.placeholder', { text: (tm.name || '?')[0] }),
        h('h2.d-team-name', { text: tm.name || '—' }),
        h('ul.d-scorers', [...scorers].map(([n, mins]) => {
          const m = mins.filter(Boolean);
          return h('li', { text: n + (mins.length > 1 && !m.length ? ` ×${mins.length}` : '') + (m.length ? ' ' + m.join(', ') : '') });
        }))
      );
    };
    const scoreEls = scores.map((s, i) => h('span.d-big', { class: prevTeamScores && prevTeamScores[i] !== s ? 'pop' : '', text: fmtNum(s) }));
    main.replaceChildren(h('div.d-sb',
      side(board.teams[0], 0),
      h('div.d-center',
        board.clock.enabled ? h('div.d-clock', { 'data-clock': '', class: board.clock.running ? 'running' : '', text: fmtClock(clockMs(board.clock)) }) : null,
        h('div.d-scoreline', scoreEls[0], h('span.d-colon', { text: ':' }), scoreEls[1])
      ),
      side(board.teams[1], 1)
    ));
    prevTeamScores = scores;
  }

  function syncTick() {
    const running = board.mode === 'scoreboard' && board.clock.enabled && board.clock.running;
    if (running && !tick) tick = setInterval(() => {
      const n = main.querySelector('[data-clock]');
      if (n) n.textContent = fmtClock(clockMs(board.clock));
    }, 250);
    if (!running && tick) { clearInterval(tick); tick = null; }
  }

  /* ----- winner overlay ----- */
  function renderWinner() {
    const entry = board.winner && board.history.find(e => e.id === board.winner);
    if (!entry) { overlay.replaceChildren(); overlay.classList.remove('on'); shownWinner = null; return; }
    overlay.replaceChildren(h('div.d-winner',
      h('h1.winner-title', { text: winnerHeadline(entry) }),
      podium(entry, board, { maxRest: 8 })
    ));
    overlay.classList.add('on');
    if (shownWinner !== entry.id) { shownWinner = entry.id; confetti(); }
  }

  /* ----------------------------------------------------- chrome */
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function closeDisplay() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    if (window.opener && window.name.startsWith('punkto-display')) window.close();
    else location.hash = '#/b/' + id;
  }

  // Show controls + cursor on mouse movement; hide after 2.5 s.
  let idle;
  const wake = () => {
    view.classList.add('awake');
    clearTimeout(idle);
    idle = setTimeout(() => view.classList.remove('awake'), 2500);
  };
  const onKey = (e) => {
    if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
    else if (e.key === 'Escape' && !document.fullscreenElement) closeDisplay();
  };
  const onResize = () => render();
  view.addEventListener('mousemove', wake);
  view.addEventListener('touchstart', wake, { passive: true });
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  wake();

  // Keep the screen awake while presenting (Screen Wake Lock API).
  let lock = null;
  const requestLock = async () => {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch { /* not allowed */ }
  };
  const onVis = () => { if (document.visibilityState === 'visible') requestLock(); };
  document.addEventListener('visibilitychange', onVis);
  requestLock();

  renderFoot();
  render();

  return {
    destroy() {
      clearInterval(tick);
      clearTimeout(idle);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      lock?.release?.().catch(() => {});
    },
    refresh() { renderFoot(); render(); },
    onEvent(msg) {
      if (msg.type === 'board' && msg.id === id) {
        if (msg.deleted) { main.replaceChildren(h('p.d-empty', { text: t('errors.notFound') })); return; }
        render();
      }
      if (msg.type === 'scheme' || msg.type === 'settings') render();
    }
  };
}
