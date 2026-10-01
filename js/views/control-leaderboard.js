// Leaderboard control body: player rows with +/- buttons, edit mode, rounds table.
import { h, btn, iconBtn, rerender, avatar, toast, confirmDialog } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtNum } from '../i18n.js';
import { newPlayer, rankPlayers, playerTotal, addPoints, setRoundScore, nextRound, namesInBoard, normName } from '../model.js';
import { editableScore, nameInput, nameInBoardError } from './common.js';

export function leaderboardBody(ctx) {
  const el = h('div.lb');
  let selected = null;       // selected player id (keyboard scoring)
  let lastTotals = new Map(); // for the "bump" animation

  const order = () => {
    const b = ctx.board;
    return b.sortControl ? rankPlayers(b.players).map(r => r.player) : b.players;
  };

  function render() {
    const b = ctx.board;
    if (selected && !b.players.some(p => p.id === selected)) selected = null;
    rerender(el, () => [toolbar(), b.showRounds ? roundsTable() : list(), addRow()]);
    // Bump animation on changed totals.
    const now = new Map(b.players.map(p => [p.id, playerTotal(p)]));
    for (const [id, v] of now) {
      if (lastTotals.has(id) && lastTotals.get(id) !== v) {
        el.querySelector(`[data-score-of="${id}"]`)?.classList.add('bump');
      }
    }
    lastTotals = now;
  }

  /* ---------------- toolbar ---------------- */
  function toolbar() {
    const b = ctx.board;
    const seg = h('div.segmented.small', { role: 'tablist', 'aria-label': t('lb.view') },
      h('button', { role: 'tab', class: !b.showRounds ? 'on' : '', 'aria-selected': String(!b.showRounds), html: icon('list'), onclick: () => setRounds(false) }, h('span', { text: t('lb.points') })),
      h('button', { role: 'tab', class: b.showRounds ? 'on' : '', 'aria-selected': String(b.showRounds), html: icon('table'), onclick: () => setRounds(true) }, h('span', { text: t('lb.rounds') }))
    );
    const showRoundCtl = b.showRounds || b.roundCount > 1;
    return h('div.toolbar',
      seg,
      showRoundCtl ? h('div.round-ctl',
        iconBtn('back', t('lb.prevRound'), () => { if (b.round > 0) { b.round--; ctx.save(); } }, b.round === 0 ? 'hidden' : ''),
        h('span.round-label', { text: t('lb.roundOf', { n: b.round + 1, total: b.roundCount }) }),
        b.round < b.roundCount - 1
          ? iconBtn('next', t('lb.nextRound'), () => { b.round++; ctx.save(); })
          : btn(t('lb.newRound'), { icon: 'plus', cls: 'btn-ghost btn-sm', title: 'N', onclick: newRound })
      ) : null,
      h('div.spacer'),
      iconBtn('sort', b.sortControl ? t('lb.sortManual') : t('lb.sortScore'), () => { b.sortControl = !b.sortControl; ctx.save(); }, b.sortControl ? 'on' : ''),
      h('button.btn.btn-ghost.btn-sm', { class: ctx.ui.edit ? 'on' : '', 'aria-pressed': String(ctx.ui.edit), onclick: ctx.toggleEdit, html: icon(ctx.ui.edit ? 'check' : 'edit') },
        h('span', { text: ctx.ui.edit ? t('common.done') : t('lb.editPlayers') }))
    );
  }

  function setRounds(on) { ctx.board.showRounds = on; ctx.save(); }
  function newRound() { ctx.mutate(nextRound); toast(t('lb.roundStarted', { n: ctx.board.round + 1 })); }

  /* ---------------- points list ---------------- */
  function list() {
    const b = ctx.board;
    if (!b.players.length) return h('div.empty.small', h('p', { text: t('lb.noPlayers') }));
    const ranks = new Map(rankPlayers(b.players).map(r => [r.player.id, r]));
    const anyScore = b.players.some(p => playerTotal(p) !== 0);
    return h('ol.lb-list', order().map((p, i) => {
      const r = ranks.get(p.id);
      return ctx.ui.edit ? editRow(p) : scoreRow(p, r, i, anyScore);
    }));
  }

  function scoreRow(p, r, i, anyScore) {
    const b = ctx.board;
    const medal = anyScore && r.rank <= 3 ? ` medal-${r.rank}` : '';
    const roundPts = b.roundCount > 1 ? Number(p.scores[b.round]) || 0 : null;
    return h('li.lb-row', {
      class: selected === p.id ? 'selected' : '', dataset: { id: p.id },
      onclick: (e) => { if (!e.target.closest('button, input')) { selected = selected === p.id ? null : p.id; render(); } }
    },
      h('span.rank', { class: medal, text: anyScore ? r.rank : i + 1, title: i < 9 ? `${t('shortcuts.selectN')}: ${i + 1}` : '' }),
      avatar(p.name),
      h('span.name', { text: p.name || '—' },
        roundPts !== null ? h('span.round-pts', { text: t('lb.thisRound', { n: fmtNum(roundPts) }) }) : null),
      h('div.score-ctl',
        // Subtract buttons, largest outermost: −3 −1 [score] +1 +3
        ...[...b.minus].reverse().map((s) => h('button.btn.step.minus', {
          class: s === b.minus[0] ? 'first' : '', 'aria-label': `−${s} ${p.name}`,
          onclick: () => ctx.mutate(bd => addPoints(bd, p.id, -s))
        }, `−${s}`)),
        // Click the score to type a new total (the difference goes into the current round).
        editableScore({
          value: r.total, label: p.name, cls: 'score', dataset: { scoreOf: p.id },
          onSet: (n) => ctx.mutate(bd => addPoints(bd, p.id, n - r.total))
        }),
        ...b.steps.map((s, k) => h('button.btn.step.plus', {
          class: k === 0 ? 'primary' : '', 'aria-label': `+${s} ${p.name}`,
          onclick: () => ctx.mutate(bd => addPoints(bd, p.id, s))
        }, `+${s}`))
      )
    );
  }

  function editRow(p) {
    const b = ctx.board;
    return h('li.lb-row.editing', { dataset: { id: p.id } },
      avatar(p.name),
      nameInput({
        class: 'name-input', dataset: { key: 'name-' + p.id }, 'aria-label': t('lb.name'),
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); el.querySelector('[data-key="add"]')?.focus(); } }
      }, {
        value: p.name,
        validate: v => nameInBoardError(b, v, p.id),
        onCommit: (v) => { p.name = v; ctx.save({ render: false }); }
      }),
      iconBtn('trash', t('common.delete'), async () => {
        if (playerTotal(p) !== 0 && !await confirmDialog(t('lb.removeConfirm', { name: p.name || '—' }), { danger: true, okLabel: t('common.delete') })) return;
        const idx = b.players.indexOf(p);
        if (idx < 0) return;
        b.players.splice(idx, 1);
        ctx.save();
        toast(t('lb.removed', { name: p.name || '—' }));
      }, 'danger-text')
    );
  }

  /* ---------------- rounds table ---------------- */
  function roundsTable() {
    const b = ctx.board;
    if (!b.players.length) return h('div.empty.small', h('p', { text: t('lb.noPlayers') }));
    const cols = Array.from({ length: b.roundCount }, (_, i) => i);
    return h('div.table-wrap', { dataset: { scrollKey: 'rounds' } },
      h('table.rounds-table',
        h('thead', h('tr',
          h('th.name-col', { text: t('lb.name') }),
          cols.map(i => h('th', { class: i === b.round ? 'current' : '' },
            h('button.linklike', { title: t('lb.makeCurrent'), text: t('lb.roundShort', { n: i + 1 }), onclick: () => { b.round = i; ctx.save(); } }))),
          h('th.total-col', { text: t('lb.total') })
        )),
        h('tbody', order().map(p => h('tr',
          h('th.name-col', { scope: 'row' }, h('div.row', avatar(p.name, 'sm'), h('span', { text: p.name || '—' }))),
          cols.map(i => h('td', { class: i === b.round ? 'current' : '' },
            h('input.cell', {
              type: 'number', inputMode: 'numeric', step: 'any', value: String(Number(p.scores[i]) || 0),
              dataset: { key: `cell-${p.id}-${i}` }, 'aria-label': `${p.name} · ${t('lb.roundShort', { n: i + 1 })}`,
              onfocus: (e) => e.target.select(),
              onchange: (e) => ctx.mutate(bd => setRoundScore(bd, p.id, i, e.target.value)),
              onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); moveCell(e.target, 1); } }
            }))),
          h('td.total-col', { text: fmtNum(playerTotal(p)) })
        )))
      ),
      h('div.row.table-foot', btn(t('lb.newRound'), { icon: 'plus', cls: 'btn-ghost btn-sm', onclick: newRound }))
    );
  }

  // Enter in a cell moves down the same column (fast entry of a round's scores).
  function moveCell(input, dir) {
    const [, pid, col] = input.dataset.key.match(/^cell-(.+)-(\d+)$/);
    const ids = order().map(p => p.id);
    const next = ids[ids.indexOf(pid) + dir];
    input.blur();
    if (next) el.querySelector(`[data-key="cell-${next}-${col}"]`)?.focus();
  }

  /* ---------------- add players ---------------- */
  function addRow() {
    const b = ctx.board;
    if (!ctx.ui.edit && b.players.length) return null;
    const input = h('input.input', {
      type: 'text', maxLength: 60, placeholder: t('lb.addPlaceholder'), dataset: { key: 'add' }, 'aria-label': t('lb.addPlayer'),
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(input.value); } },
      onpaste: (e) => {
        const text = e.clipboardData?.getData('text') || '';
        if (/\n/.test(text.trim())) { e.preventDefault(); add(text); }
      }
    });
    return h('div.add-row',
      input,
      btn(t('lb.add'), { icon: 'plus', cls: 'btn-primary', onclick: () => add(input.value) }),
      h('p.small.muted.full', { text: t('lb.addHint') })
    );
  }

  function add(text) {
    const names = String(text).split(/\r?\n/).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 200);
    const input = el.querySelector('[data-key="add"]');
    if (!names.length) {
      if (String(text).trim() === '' && input) { toast(t('errors.nameRequired'), { kind: 'error' }); input.focus(); }
      return;
    }
    // Names must be unique within the board (also within the pasted list).
    const taken = namesInBoard(ctx.board);
    const fresh = names.filter(n => !taken.has(normName(n)) && (taken.add(normName(n)), true));
    const skipped = names.length - fresh.length;
    if (!fresh.length) {
      toast(names.length === 1 ? t('errors.nameTaken') : t('lb.skipped', { n: skipped }), { kind: 'error' });
      input?.focus();
      input?.select();
      return;
    }
    fresh.forEach(n => ctx.board.players.push(newPlayer(n)));
    ctx.ui.edit = true;
    ctx.save();
    if (skipped) toast(t('lb.skipped', { n: skipped }), { kind: 'error', ms: 4000 });
    el.querySelector('[data-key="add"]')?.focus();
    const list = el.querySelector('.lb-list');
    list?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }

  /* ---------------- keyboard ---------------- */
  function onKey(e) {
    const b = ctx.board;
    const ids = order().map(p => p.id);
    const sel = () => selected ?? ids[0];
    const k = e.key;
    if (k === 'ArrowDown' || k === 'j' || k === 'ArrowUp' || k === 'k') {
      if (!ids.length) return false;
      const dir = (k === 'ArrowDown' || k === 'j') ? 1 : -1;
      const i = selected ? ids.indexOf(selected) : (dir > 0 ? -1 : ids.length);
      selected = ids[Math.min(ids.length - 1, Math.max(0, i + dir))];
      render();
      el.querySelector('.lb-row.selected')?.scrollIntoView({ block: 'nearest' });
      return true;
    }
    if (/^[0-9]$/.test(k) && !b.showRounds) {
      const n = k === '0' ? 9 : Number(k) - 1;
      if (ids[n]) { selected = ids[n]; render(); return true; }
      return false;
    }
    const second = e.shiftKey && k.startsWith('Arrow');
    const step = second ? (b.steps[1] ?? b.steps[0]) : b.steps[0];
    const minus = second ? (b.minus[1] ?? b.minus[0]) : b.minus[0];
    if ((k === '+' || k === '=' || k === 'ArrowRight') && ids.length && !b.showRounds) {
      const id = sel(); selected = id;
      ctx.mutate(bd => addPoints(bd, id, step));
      return true;
    }
    if ((k === '-' || k === '_' || k === 'ArrowLeft') && ids.length && !b.showRounds) {
      const id = sel(); selected = id;
      ctx.mutate(bd => addPoints(bd, id, -minus));
      return true;
    }
    if (k === 'n' || k === 'N') { newRound(); return true; }
    if (k === 'r' || k === 'R') { setRounds(!b.showRounds); return true; }
    if (k === 'e' || k === 'E') { ctx.toggleEdit(); return true; }
    if (k === 'Escape' && selected) { selected = null; render(); return true; }
    return false;
  }

  return {
    el, render, onKey,
    afterMount() { if (ctx.ui.edit) el.querySelector('[data-key="add"]')?.focus(); }
  };
}
