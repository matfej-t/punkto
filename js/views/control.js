// Control view: the host's screen for editing scores.
// Shell (top bar, menu, dialogs, undo, keyboard, ad slot) + a mode-specific body.
import { h, btn, iconBtn, modal, popMenu, promptDialog, confirmDialog, toast, downloadText, pickFile, fill } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtDate } from '../i18n.js';
import * as store from '../store.js';
import { scoreSnapshot, restoreSnapshot, endGame, resetScores, hasScores, entryWinners } from '../model.js';
import { toggleScheme } from '../theme.js';
import { processImage } from '../images.js';
import { exportJson, safeFilename } from '../share.js';
import { adSlot, adsActive } from '../ads.js';
import { openPremium, stepsInput } from './common.js';
import { openDisplayWindow, copyBoardLink } from './home.js';
import { leaderboardBody } from './control-leaderboard.js';
import { scoreboardBody } from './control-scoreboard.js';

const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function controlView(root, id) {
  let board = store.getBoard(id);
  if (!board) return notFound(root);
  document.body.classList.add('is-control');
  // Back on the board → the TV leaves the winner screen too.
  if (board.winner) { board.winner = null; store.saveBoard(board, { touch: false }); }
  document.title = `${board.title} · Punkto`;

  const ui = {
    edit: board.mode === 'leaderboard' ? board.players.length === 0 : false,
    undo: []
  };

  /* ---- state helpers handed to the body ---- */
  const ctx = {
    get board() { return board; },
    ui,
    /** Score change: undoable, saved, re-rendered. */
    mutate(fn, { undoable = true } = {}) {
      if (undoable) {
        ui.undo.push(scoreSnapshot(board));
        if (ui.undo.length > 100) ui.undo.shift();
      }
      fn(board);
      store.saveBoard(board);
      body.render();
      updateBar();
    },
    /** Structural change (names, logos, settings): saved, re-rendered. */
    save({ render = true } = {}) {
      store.saveBoard(board);
      if (render) body.render();
      updateBar();
    },
    toggleEdit() { ui.edit = !ui.edit; body.render(); },
    openDisplay: () => openDisplayWindow(board.id)
  };

  const body = board.mode === 'leaderboard' ? leaderboardBody(ctx) : scoreboardBody(ctx);

  /* ---- top bar ---- */
  const titleBtn = h('button.ctl-title', { title: t('common.rename'), onclick: rename });
  const undoBtn = iconBtn('undo', `${t('control.undo')} (Ctrl+Z)`, undo);
  const bar = h('header.ctl-bar',
    h('a.btn.icon-btn', { href: '#/', title: t('common.back'), 'aria-label': t('common.back'), html: icon('back') }),
    titleBtn,
    h('div.spacer'),
    undoBtn,
    adsActive() ? h('button.chip.adfree-chip', { onclick: openPremium, html: icon('sparkle') }, h('span', { text: t('premium.adFree') })) : null,
    h('button.btn.btn-primary.display-btn', { onclick: ctx.openDisplay, title: `${t('control.openDisplay')} (D)`, html: icon('display') },
      h('span', { text: t('control.display') })),
    iconBtn('more', t('common.more'), (e) => popMenu(e.currentTarget, [
      { label: t('settings.boardSettings'), icon: 'settings', onClick: openBoardSettings },
      { label: t('history.title'), icon: 'history', onClick: openHistory },
      { label: t('control.presentHere'), icon: 'fullscreen', onClick: presentHere },
      'sep',
      { label: t('share.copyLink'), icon: 'link', onClick: () => copyBoardLink(board) },
      { label: t('share.export'), icon: 'download', onClick: () => downloadText(safeFilename(board.title) + '.json', exportJson([board])) },
      { label: t('settings.toggleTheme'), icon: 'moon', onClick: toggleScheme },
      { label: t('shortcuts.title'), icon: 'keyboard', hint: '?', onClick: () => openShortcuts(board.mode) },
      'sep',
      { label: t('control.endGame'), icon: 'flag', onClick: endGameFlow }
    ]))
  );

  function updateBar() {
    fill(titleBtn, 
      board.logo ? h('img.ctl-logo', { src: board.logo, alt: '' }) : null,
      h('span', { text: board.title })
    );
    undoBtn.disabled = ui.undo.length === 0;
    document.title = `${board.title} · Punkto`;
  }

  /* ---- page ---- */
  const endBtn = btn(t('control.endGame'), { icon: 'flag', cls: 'btn-end', onclick: endGameFlow });
  root.append(
    bar,
    h('main.ctl-main', body.el,
      h('div.ctl-end', endBtn, h('p.small.muted', { text: t('control.endGameHint') }))
    ),
    // Ads live at the very bottom, separated from every control by a large gap.
    h('div.ad-zone', adSlot('control')),
    h('footer.ctl-footer.small.muted',
      h('a', { href: '#/privacy', text: t('footer.privacy') }), ' · ',
      h('button.linklike', { text: t('shortcuts.title'), onclick: () => openShortcuts(board.mode) })
    )
  );
  updateBar();
  body.render();
  body.afterMount?.();

  /* ---- actions ---- */
  function undo() {
    const snap = ui.undo.pop();
    if (!snap) return;
    restoreSnapshot(board, snap);
    store.saveBoard(board);
    body.render();
    updateBar();
    toast(t('control.undone'));
  }

  async function rename() {
    const name = await promptDialog(t('common.rename'), { value: board.title });
    if (name) { board.title = name; ctx.save(); }
  }

  function presentHere() {
    document.documentElement.requestFullscreen?.().catch(() => {});
    location.hash = '#/display/' + board.id;
  }

  async function endGameFlow() {
    const empty = board.mode === 'leaderboard' ? board.players.length === 0 : false;
    if (empty) { toast(t('control.addPlayersFirst')); return; }
    if (!await confirmDialog(t('control.endGameConfirm'), { title: t('control.endGame'), okLabel: t('control.endGame') })) return;
    endGame(board);
    ui.undo = [];
    store.saveBoard(board);
    location.hash = `#/winner/${board.id}/${board.winner}`;
  }

  function openHistory() {
    const list = h('div.history-list');
    const draw = () => {
      if (!board.history.length) { list.replaceChildren(h('p.muted', { text: t('history.empty') })); return; }
      list.replaceChildren(...board.history.map(e => {
        const w = entryWinners(e);
        const line = e.mode === 'scoreboard'
          ? `${e.teams[0].name} ${e.teams[0].score} : ${e.teams[1].score} ${e.teams[1].name}`
          : (w.names.length ? `${w.names.join(', ')} · ${e.standings[0].total}` : '—');
        return h('div.history-item',
          h('a.history-main', { href: `#/winner/${board.id}/${e.id}`, onclick: () => m.close() },
            h('span.small.muted', { text: fmtDate(e.endedAt) }),
            h('strong', { html: icon('trophy') }, h('span', { text: line }))
          ),
          iconBtn('trash', t('common.delete'), async () => {
            if (!await confirmDialog(t('history.deleteConfirm'), { danger: true, okLabel: t('common.delete') })) return;
            board.history = board.history.filter(x => x.id !== e.id);
            if (board.winner === e.id) board.winner = null;
            ctx.save();
            draw();
          })
        );
      }));
    };
    draw();
    const m = modal({ title: t('history.title'), content: list, actions: [{ label: t('common.done'), kind: 'primary' }] });
  }

  function openBoardSettings() {
    const content = h('div.stack');
    const m = modal({ title: t('settings.boardSettings'), content, wide: true, actions: [{ label: t('common.done'), kind: 'primary' }] });
    const draw = () => fill(content, boardSettingsFields(ctx, draw, () => m.close()));
    draw();
  }

  /* ---- keyboard ---- */
  function onKey(e) {
    if (document.querySelector('dialog[open]') || document.querySelector('.menu')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !isTyping(e.target)) { e.preventDefault(); undo(); return; }
    if (mod || e.altKey || isTyping(e.target)) return;
    if (body.onKey?.(e)) { e.preventDefault(); return; }
    switch (e.key) {
      case 'd': case 'D': ctx.openDisplay(); break;
      case 'z': case 'Z': undo(); break;
      case '?': openShortcuts(board.mode); break;
      default: return;
    }
    e.preventDefault();
  }
  document.addEventListener('keydown', onKey);

  return {
    destroy() { document.removeEventListener('keydown', onKey); body.destroy?.(); },
    refresh() { body.render(); updateBar(); },
    onEvent(msg) {
      if (msg.type === 'board' && msg.id === board.id) {
        if (msg.deleted) { location.hash = '#/'; return; }
        const fresh = store.getBoard(board.id);
        if (fresh) { board = fresh; body.render(); updateBar(); }
      }
    }
  };
}

/* ---------------------------------------------------------- board settings */

function boardSettingsFields(ctx, redraw, closeModal) {
  const b = ctx.board;
  const save = () => ctx.save();

  const title = h('input.input', { type: 'text', value: b.title, maxLength: 80, oninput: (e) => { b.title = e.target.value.trim() || b.title; ctx.save({ render: false }); } });

  const logoRow = h('div.row',
    b.logo ? h('img.logo-preview', { src: b.logo, alt: '' }) : h('div.logo-preview.empty', { html: icon('image') }),
    btn(b.logo ? t('settings.changeLogo') : t('settings.uploadLogo'), { icon: 'upload', cls: 'btn-ghost', onclick: async () => {
      const f = await pickFile('image/*');
      if (!f) return;
      try { b.logo = await processImage(f, 'logo'); save(); redraw(); } catch { toast(t('errors.badImage'), { kind: 'error' }); }
    } }),
    b.logo ? btn(t('common.remove'), { cls: 'btn-ghost', onclick: () => { b.logo = null; save(); redraw(); } }) : null
  );

  const steps = stepsInput(b.steps, (s) => { b.steps = s; save(); });

  const modeFields = [];
  if (b.mode === 'scoreboard') {
    modeFields.push(
      h('label.check', h('input', { type: 'checkbox', checked: b.clock.enabled, onchange: (e) => { b.clock.enabled = e.target.checked; save(); } }),
        h('span', { text: t('settings.clock') }))
    );
  }

  return [
    h('label.field', h('span.field-label', { text: t('settings.boardTitle') }), title),
    h('div.field', h('span.field-label', { text: t('settings.logo') }), logoRow),
    h('label.field', h('span.field-label', { text: t('settings.steps') }), steps, h('span.small.muted', { text: t('settings.stepsHint') })),
    ...modeFields,
    h('div.divider'),
    h('div.row.wrap',
      btn(t('settings.resetScores'), { icon: 'reset', cls: 'btn-ghost', onclick: async () => {
        if (!hasScores(b)) return;
        if (!await confirmDialog(t('settings.resetConfirm'), { danger: true, okLabel: t('settings.resetScores') })) return;
        ctx.mutate(resetScores);
        toast(t('control.undoHint'));
      } }),
      btn(t('settings.deleteBoard'), { icon: 'trash', cls: 'btn-ghost danger-text', onclick: async () => {
        if (!await confirmDialog(t('home.deleteConfirm', { title: b.title }), { danger: true, okLabel: t('common.delete') })) return;
        closeModal();
        store.deleteBoard(b.id);
        location.hash = '#/';
      } })
    )
  ];
}

/* --------------------------------------------------------------- shortcuts */

export function openShortcuts(mode) {
  const rows = mode === 'leaderboard'
    ? [['↑ ↓', 'shortcuts.select'], ['1 – 9', 'shortcuts.selectN'], ['+  →', 'shortcuts.add'], ['−  ←', 'shortcuts.sub'],
       ['Shift + → / ←', 'shortcuts.add2'], ['N', 'shortcuts.nextRound'], ['R', 'shortcuts.rounds'], ['E', 'shortcuts.edit']]
    : [['Q', 'shortcuts.homePlus'], ['A', 'shortcuts.homeMinus'], ['P', 'shortcuts.awayPlus'], ['L', 'shortcuts.awayMinus'],
       ['1 – 9', 'shortcuts.pickScorer'], ['Space', 'shortcuts.clock'], ['E', 'shortcuts.edit']];
  rows.push(['D', 'shortcuts.display'], ['Z / Ctrl+Z', 'shortcuts.undo'], ['?', 'shortcuts.help']);
  modal({
    title: t('shortcuts.title'),
    content: h('table.shortcuts', h('tbody', rows.map(([k, label]) => h('tr', h('td', h('kbd', { text: k })), h('td', { text: t(label) }))))),
    actions: [{ label: t('common.done'), kind: 'primary' }]
  });
}

function notFound(root) {
  root.append(h('main.page.center',
    h('h1', { text: t('errors.notFound') }),
    h('p.muted', { text: t('errors.notFoundText') }),
    h('a.btn.btn-primary', { href: '#/', text: t('common.home') })
  ));
  return null;
}
