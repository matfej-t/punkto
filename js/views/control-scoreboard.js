// Scoreboard control body: two teams, goals with scorer, squads, match clock.
import { h, btn, iconBtn, rerender, modal, toast, pickFile } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtNum } from '../i18n.js';
import { teamScore, addGoal, removeLastGoal, toggleClock, resetClock, clockMs, fmtClock, minuteOf, uid } from '../model.js';
import { teamColor, teamInk } from '../theme.js';
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
    const style = { '--team': teamColor(b, i), '--team-ink': teamInk(b, i) };
    const logo = tm.logo ? h('img.team-logo', { src: tm.logo, alt: '' }) : h('span.team-logo.placeholder', { text: (tm.name || '?')[0] });

    if (ctx.ui.edit) {
      return h('section.team-card.editing', { style },
        h('div.team-head',
          h('button.avatar-btn.logo-btn', { title: t('sb.logo'), 'aria-label': t('sb.logo'), onclick: () => uploadLogo(tm) }, logo, h('span.avatar-edit', { html: icon('image') })),
          h('input.input.team-name-input', {
            type: 'text', value: tm.name, maxLength: 60, dataset: { key: 'team-' + i }, 'aria-label': t('sb.teamName'),
            oninput: (e) => { tm.name = e.target.value; ctx.save({ render: false }); }
          })
        ),
        tm.logo ? btn(t('lb.removePhoto'), { cls: 'btn-ghost btn-sm', onclick: () => { tm.logo = null; ctx.save(); } }) : null,
        h('div.squad-edit',
          h('span.field-label', { text: t('sb.squad') }),
          h('ul.squad-list', tm.players.map(p => h('li',
            h('input.input.input-sm', {
              type: 'text', value: p.name, maxLength: 60, dataset: { key: `pl-${p.id}` }, 'aria-label': t('lb.name'),
              oninput: (e) => { p.name = e.target.value; ctx.save({ render: false }); }
            }),
            iconBtn('trash', t('common.delete'), () => { tm.players = tm.players.filter(x => x !== p); ctx.save(); }, 'danger-text')
          ))),
          squadAdd(tm, i)
        )
      );
    }

    return h('section.team-card', { style },
      h('div.team-head', logo, h('h2.team-name', { text: tm.name || '—' })),
      h('div.team-score', { dataset: { teamScore: i }, text: fmtNum(score), 'aria-live': 'polite' }),
      h('div.team-buttons',
        h('button.btn.step.minus', { 'aria-label': `−1 ${tm.name}`, title: KEYS[i][1], onclick: () => ctx.mutate(bd => removeLastGoal(bd, tm.id)), html: icon('minus') }),
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
      const names = String(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 60);
      if (!names.length) return;
      names.forEach(n => tm.players.push({ id: uid(), name: n.slice(0, 60) }));
      ctx.save();
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
        return h('li.event', { style: { '--team': teamColor(b, i) } },
          h('span.dot'),
          ev.t != null ? h('span.minute', { text: minuteOf(ev.t) + "'" }) : null,
          h('span.ev-team', { text: tm.name }),
          h('span.ev-player', { text: pl ? pl.name : '' }),
          ev.points !== 1 ? h('span.ev-pts', { text: '+' + ev.points }) : null,
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
    if (k === 'a') { ctx.mutate(bd => removeLastGoal(bd, bd.teams[0].id)); return true; }
    if (k === 'l') { ctx.mutate(bd => removeLastGoal(bd, bd.teams[1].id)); return true; }
    if (k === ' ' && b.clock.enabled) { ctx.mutate(toggleClock, { undoable: false }); return true; }
    if (k === 'e') { ctx.toggleEdit(); return true; }
    return false;
  }

  return {
    el, render, onKey,
    destroy() { if (tick) clearInterval(tick); }
  };
}
