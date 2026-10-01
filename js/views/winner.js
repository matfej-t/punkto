// Winner screen (podium) for a finished game + the shared podium component.
import { h, btn, avatar } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtNum, fmtDate } from '../i18n.js';
import * as store from '../store.js';
import { entryWinners, minuteOf } from '../model.js';
import { applyPalette, inkFor } from '../theme.js';
import { confetti } from '../confetti.js';
import { openDisplayWindow } from './home.js';

/** Headline for a finished game. */
export function winnerHeadline(entry) {
  const w = entryWinners(entry);
  if (w.draw) return t('winner.draw');
  if (w.tie) return t('winner.tie', { names: w.names.join(' & ') });
  return t('winner.wins', { name: w.names[0] || '—' });
}

/** Podium / final score element for a history entry. */
export function podium(entry, board, { maxRest = 12 } = {}) {
  if (entry.mode === 'scoreboard') return finalScore(entry, board);
  const photos = new Map((board.players || []).map(p => [p.id, p.photo]));
  const s = entry.standings;
  const top = s.slice(0, 3);
  const order = [top[1], top[0], top[2]]; // 2nd – 1st – 3rd
  const place = (row, pos) => {
    if (!row) return h('div.pod-col.empty');
    return h('div.pod-col', { class: 'pos-' + pos },
      h('div.pod-person',
        pos === 1 ? h('span.crown', { html: icon('trophy') }) : null,
        avatar(row.name, photos.get(row.id), 'pod-avatar'),
        h('span.pod-name', { text: row.name || '—' }),
        h('span.pod-score', { text: fmtNum(row.total) })
      ),
      h('div.pod-block', h('span', { text: row.rank }))
    );
  };
  const rest = s.slice(3, 3 + maxRest);
  return h('div.podium-wrap',
    h('div.podium', place(order[0], 2), place(order[1], 1), place(order[2], 3)),
    rest.length ? h('ol.pod-rest', { start: 4 }, rest.map(r => h('li',
      h('span.rk', { text: r.rank }), h('span.nm', { text: r.name || '—' }), h('span.sc', { text: fmtNum(r.total) })
    ))) : null,
    s.length > 3 + maxRest ? h('p.muted.small.center', { text: t('winner.more', { n: s.length - 3 - maxRest }) }) : null
  );
}

function finalScore(entry, board) {
  const [a, b] = entry.teams;
  const logos = new Map((board.teams || []).map(tm => [tm.id, tm.logo]));
  const side = (tm, i) => {
    const won = tm.score > entry.teams[1 - i].score;
    const color = tm.color || (i === 0 ? 'var(--accent)' : 'var(--accent-2)');
    const scorers = entry.events.filter(e => e.teamId === tm.id && e.player);
    return h('div.final-team', { class: won ? 'won' : '', style: { '--team': color, '--team-ink': tm.color ? inkFor(tm.color) : (i === 0 ? 'var(--accent-ink)' : 'var(--accent-2-ink)') } },
      won ? h('span.crown', { html: icon('trophy') }) : null,
      logos.get(tm.id) ? h('img.team-logo', { src: logos.get(tm.id), alt: '' }) : h('span.team-logo.placeholder', { text: (tm.name || '?')[0] }),
      h('span.final-name', { text: tm.name }),
      h('ul.final-scorers', scorers.map(e => h('li', { text: e.player + (e.t != null ? ` ${minuteOf(e.t)}'` : '') })))
    );
  };
  return h('div.final',
    side(a, 0),
    h('div.final-score', h('span', { text: a.score }), h('span.sep', { text: ':' }), h('span', { text: b.score })),
    side(b, 1)
  );
}

/* ------------------------------------------------------------ route view */

export function winnerView(root, id, hid) {
  const board = store.getBoard(id);
  const entry = board?.history.find(e => e.id === hid);
  if (!board || !entry) { location.replace(board ? '#/b/' + id : '#/'); return null; }
  applyPalette(board);
  document.body.classList.add('is-winner');
  document.title = `${winnerHeadline(entry)} · ${board.title}`;
  let keep = false;

  const showOnDisplay = () => {
    const b = store.getBoard(id);
    b.winner = hid;
    store.saveBoard(b, { touch: false });
    openDisplayWindow(id);
  };
  const isLatest = board.history[0]?.id === hid;

  root.append(
    h('header.ctl-bar',
      h('a.btn.icon-btn', { href: '#/b/' + id, title: t('common.back'), 'aria-label': t('common.back'), html: icon('back') }),
      h('span.ctl-title.static', { text: board.title }),
      h('div.spacer')
    ),
    h('main.winner-page',
      h('p.muted.small.center', { text: fmtDate(entry.endedAt) }),
      h('h1.winner-title', { text: winnerHeadline(entry) }),
      podium(entry, board),
      h('div.row.center.wrap.winner-actions',
        btn(isLatest ? t('winner.newGame') : t('winner.backToBoard'), { icon: isLatest ? 'plus' : 'back', cls: 'btn-primary btn-lg', onclick: () => { location.hash = '#/b/' + id; } }),
        btn(t('winner.showOnDisplay'), { icon: 'display', cls: 'btn-ghost btn-lg', onclick: showOnDisplay }),
        btn(t('control.presentHere'), { icon: 'fullscreen', cls: 'btn-ghost btn-lg', onclick: () => {
          keep = true;
          const b = store.getBoard(id);
          b.winner = hid;
          store.saveBoard(b, { touch: false });
          document.documentElement.requestFullscreen?.().catch(() => {});
          location.hash = '#/display/' + id;
        } })
      )
    )
  );
  if (board.winner === hid) setTimeout(() => confetti(), 250);

  return {
    // Leaving the winner screen returns the TV display to the live board.
    destroy() {
      if (keep) return;
      const b = store.getBoard(id);
      if (b && b.winner) { b.winner = null; store.saveBoard(b, { touch: false }); }
    }
  };
}
