// Scoreboard control body: two teams, goals with scorer, squads, match clock.
import { h, btn, iconBtn, rerender, modal, toast, pickFile } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';
import { teamScore, addGoal, toggleClock, resetClock, clockMs, fmtClock, minuteOf, uid, namesInBoard, normName } from '../model.js';
import { editableScore, nameInput, nameInBoardError } from './common.js';
import { teamVars } from '../theme.js';
import { processImage } from '../images.js';

const KEYS = [['Q', 'A'], ['P', 'L']];

export function scoreboardBody(ctx) {
  const el = h('div.sb');
  let tick = null;
  let lastScores = [];

  function render() {
    const b = ctx.board;
    rerender(el, () => [
      toolbar(),
      h('div.sb-teams', b.teams.map((tm, i) => teamCard(tm, i))),
      b.clock.enabled ? clockCard() : null,
      timeline()
    ]);
    const scores = b.teams.map(tm => teamScore(b, tm.id));
    scores.forEach((s, i) => { if (lastScores.length && lastScores[i] !== s) el.querySelector(`[data-team-score="${i}"]`)?.classList.add('bump'); });
    lastScores = scores;
    syncTick();
  }

  function toolbar() {
    return h('div.toolbar',
      h('div.spacer'),
      h('button.btn.btn-ghost.btn-sm', { class: ctx.ui.edit ? 'on' : '', 'aria-pressed': String(ctx.ui.edit), onclick: ctx.toggleEdit, html: icon(ctx.ui.edit ? 'check' : 'edit') },
        h('span', { text: ctx.ui.edit ? t('common.done') : t('sb.editTeams') }))
    );
  }

  /* ---------------- team cards ---------------- */
  function teamCard(tm, i) {
    const b = ctx.board;
    const score = teamScore(b, tm.id);
    const style = teamVars(i);
    const logo = tm.logo ? h('img.team-logo', { src: tm.logo, alt: '' }) : h('span.team-logo.placeholder', { text: (tm.name || '?')[0] });

    if (ctx.ui.edit) {
      return h('section.team-card.editing', { style },
        h('div.team-head',
          h('button.avatar-btn.logo-btn', { title: t('sb.logo'), 'aria-label': t('sb.logo'), onclick: () => uploadLogo(tm) }, logo, h('span.avatar-edit', { html: icon('image') })),
          nameInput({ class: 'team-name-input', dataset: { key: 'team-' + i }, 'aria-label': t('sb.teamName') }, {
            value: tm.name,
            validate: v => nameInBoardError(b, v, tm.id),
            onCommit: (v) => { tm.name = v; ctx.save({ render: false }); }
          })
        ),
        tm.logo ? btn(t('sb.removeLogo'), { cls: 'btn-ghost btn-sm', onclick: () => { tm.logo = null; ctx.save(); } }) : null,
        h('div.squad-edit',
          h('span.field-label', { text: t('sb.squad') }),
          h('ul.squad-list', tm.players.map(p => h('li',
            nameInput({ class: 'input-sm', dataset: { key: `pl-${p.id}` }, 'aria-label': t('lb.name') }, {
              value: p.name,
              validate: v => nameInBoardError(b, v, p.id),
              onCommit: (v) => { p.name = v; ctx.save({ render: false }); }
            }),
            iconBtn('trash', t('common.delete'), () => { tm.players = tm.players.filter(x => x !== p); ctx.save(); }, 'danger-text')
          ))),
          squadAdd(tm, i)
        )
      );
    }

    return h('section.team-card', { style },
      h('div.team-head', logo, h('h2.team-name', { text: tm.name || '—' })),
      // Click the score to type a new one; the difference is recorded as a correction.
      editableScore({
        value: score, label: tm.name, cls: 'team-score', dataset: { teamScore: i },
        onSet: (n) => ctx.mutate(bd => addGoal(bd, tm.id, null, n - score))
      }),
      h('div.team-buttons',
        ...[...b.minus].reverse().map((s) => h('button.btn.step.minus', {
          class: s === b.minus[0] ? 'first' : '', title: s === b.minus[0] ? KEYS[i][1] : '', 'aria-label': `−${s} ${tm.name}`,
          onclick: () => ctx.mutate(bd => addGoal(bd, tm.id, null, -s))
        }, `−${s}`)),
        ...b.steps.map((s, k) => h('button.btn.step.plus.goal-btn', {
          class: k === 0 ? 'primary' : '', title: k === 0 ? KEYS[i][0] : '', 'aria-label': `+${s} ${tm.name}`,
          onclick: () => scoreFor(i, s)
        }, `+${s}`))
      ),
      tm.players.length ? h('div.squad-chips',
        h('span.small.muted', { text: t('sb.tapScorer') }),
        h('div.chips', tm.players.map(p => h('button.chip', { text: p.name || '—', onclick: () => ctx.mutate(bd => addGoal(bd, tm.id, p.id, b.steps[0])) })))
      ) : null,
      h('p.key-hint.small.muted', { text: `${KEYS[i][0]} +  ·  ${KEYS[i][1]} −` })
    );
  }

  function squadAdd(tm, i) {
    const input = h('input.input.input-sm', {
      type: 'text', maxLength: 60, placeholder: t('sb.addPlayer'), dataset: { key: 'sq-add-' + i },
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(input.value); } },
      onpaste: (e) => {
        const text = e.clipboardData?.getData('text') || '';
        if (/\n/.test(text.trim())) { e.preventDefault(); add(text); }
      }
    });
    function add(text) {
      const names = String(text).split(/\r?\n/).map(s => s.trim().replace(/\s+/g, ' ').slice(0, 60)).filter(Boolean).slice(0, 60);
      if (!names.length) { if (!String(text).trim()) toast(t('errors.nameRequired'), { kind: 'error' }); return; }
      // Team and player names are unique across the whole board.
      const taken = namesInBoard(ctx.board);
      const fresh = names.filter(n => !taken.has(normName(n)) && (taken.add(normName(n)), true));
      const skipped = names.length - fresh.length;
      if (!fresh.length) { toast(names.length === 1 ? t('errors.nameTaken') : t('lb.skipped', { n: skipped }), { kind: 'error' }); return; }
      fresh.forEach(n => tm.players.push({ id: uid(), name: n }));
      ctx.save();
      if (skipped) toast(t('lb.skipped', { n: skipped }), { kind: 'error', ms: 4000 });
      el.querySelector(`[data-key="sq-add-${i}"]`)?.focus();
    }
    return h('div.row', input, iconBtn('plus', t('lb.add'), () => add(input.value)));
  }

  async function uploadLogo(tm) {
    const f = await pickFile('image/*');
    if (!f) return;
    try { tm.logo = await processImage(f, 'logo'); ctx.save(); } catch { toast(t('errors.badImage'), { kind: 'error' }); }
  }

  /** +points for team i; asks who scored when the team has a squad. */
  function scoreFor(i, points) {
    const b = ctx.board;
    const tm = b.teams[i];
    if (!tm.players.length) { ctx.mutate(bd => addGoal(bd, tm.id, null, points)); return; }
    let m;
    const pick = (pid) => { m.close(); ctx.mutate(bd => addGoal(bd, tm.id, pid, points)); };
    const onKey = (e) => {
      if (/^[1-9]$/.test(e.key) && tm.players[Number(e.key) - 1]) { e.preventDefault(); pick(tm.players[Number(e.key) - 1].id); }
      if (e.key === '0') { e.preventDefault(); pick(null); }
    };
    m = modal({
      title: t('sb.whoScored', { team: tm.name }),
      cls: 'scorer-modal',
      content: h('div.scorer-grid', tm.players.map((p, k) => h('button.btn.scorer', { onclick: () => pick(p.id) },
        k < 9 ? h('kbd', { text: k + 1 }) : null, h('span', { text: p.name || '—' }))),
        h('button.btn.btn-ghost.scorer', { onclick: () => pick(null) }, h('kbd', { text: '0' }), h('span', { text: t('sb.noScorer') }))),
      onClose: () => document.removeEventListener('keydown', onKey, true)
    });
    document.addEventListener('keydown', onKey, true);
  }

  /* ---------------- clock ---------------- */
  function clockCard() {
    const c = ctx.board.clock;
    return h('section.clock-card',
      h('span.clock-time', { 'data-clock': '', text: fmtClock(clockMs(c)) }),
      h('button.btn', { class: c.running ? '' : 'btn-primary', onclick: () => ctx.mutate(toggleClock, { undoable: false }), title: 'Space', html: icon(c.running ? 'pause' : 'play') },
        h('span', { text: c.running ? t('sb.pause') : (c.elapsed ? t('sb.resume') : t('sb.start')) })),
      iconBtn('reset', t('sb.resetClock'), () => ctx.mutate(resetClock, { undoable: false }))
    );
  }

  function syncTick() {
    const running = ctx.board.clock.enabled && ctx.board.clock.running;
    if (running && !tick) tick = setInterval(() => {
      const n = el.querySelector('[data-clock]');
      if (n) n.textContent = fmtClock(clockMs(ctx.board.clock));
    }, 250);
    if (!running && tick) { clearInterval(tick); tick = null; }
  }

  /* ---------------- timeline ---------------- */
  function timeline() {
    const b = ctx.board;
    if (!b.events.length) return h('p.small.muted.center.timeline-empty', { text: t('sb.noGoals') });
    return h('section.timeline',
      h('h3', { text: t('sb.timeline') }),
      h('ol', [...b.events].reverse().map(ev => {
        const i = b.teams.findIndex(x => x.id === ev.teamId);
        const tm = b.teams[i];
        const pl = tm.players.find(p => p.id === ev.playerId);
        return h('li.event', { style: teamVars(i) },
          h('span.dot'),
          ev.t != null ? h('span.minute', { text: minuteOf(ev.t) + "'" }) : null,
          h('span.ev-team', { text: tm.name }),
          h('span.ev-player', { text: pl ? pl.name : '' }),
          ev.points !== 1 ? h('span.ev-pts', { class: ev.points < 0 ? 'neg' : '', text: (ev.points < 0 ? '−' : '+') + Math.abs(ev.points) }) : null,
          iconBtn('close', t('common.remove'), () => ctx.mutate(bd => { bd.events = bd.events.filter(x => x.id !== ev.id); }), 'btn-sm')
        );
      }))
    );
  }

  /* ---------------- keyboard ---------------- */
  function onKey(e) {
    const b = ctx.board;
    const k = e.key.toLowerCase();
    if (k === 'q') { scoreFor(0, b.steps[0]); return true; }
    if (k === 'p') { scoreFor(1, b.steps[0]); return true; }
    if (k === 'a') { ctx.mutate(bd => addGoal(bd, bd.teams[0].id, null, -b.minus[0])); return true; }
    if (k === 'l') { ctx.mutate(bd => addGoal(bd, bd.teams[1].id, null, -b.minus[0])); return true; }
    if (k === ' ' && b.clock.enabled) { ctx.mutate(toggleClock, { undoable: false }); return true; }
    if (k === 'e') { ctx.toggleEdit(); return true; }
    return false;
  }

  return {
    el, render, onKey,
    destroy() { if (tick) clearInterval(tick); }
  };
}
