// Home screen: intro + privacy note, saved boards, create dialog, FAQ.
import { h, btn, iconBtn, modal, popMenu, promptDialog, confirmDialog, toast, copyText, downloadText, rerender } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtAgo, fmtNum } from '../i18n.js';
import * as store from '../store.js';
import { newBoard, newPlayer, cloneBoard, boardSummary, addGoal } from '../model.js';
import { applyPalette, PALETTE_SWATCHES } from '../theme.js';
import { leaderboardArt, scoreboardArt } from '../illustrations.js';
import { boardToLink, exportJson, safeFilename } from '../share.js';
import { appBar, footer, importFromFile } from './common.js';

export function homeView(root) {
  applyPalette(null);
  document.title = t('meta.title');
  const boardsWrap = h('div');

  const render = () => {
    const boards = store.listBoards();
    rerender(boardsWrap, () => boardsSection(boards, render));
  };

  root.append(
    appBar(),
    h('main.home',
      hero(store.listBoards().length > 0),
      boardsWrap,
      features(),
      faq()
    ),
    footer()
  );
  render();

  return {
    onEvent(msg) { if (msg.type === 'board' || msg.type === 'index') render(); },
    refresh: render
  };
}

function hero(compact) {
  return h('section.hero', { class: compact ? 'compact' : '' },
    h('h1', { text: t('home.h1') }),
    h('p.lead', { text: t('home.tagline') }),
    h('div.privacy-note', { html: icon('lock') },
      h('div', h('strong', { text: t('home.privacyTitle') }), ' ', h('span', { text: t('home.privacyText') }))
    )
  );
}

function boardsSection(boards, render) {
  const head = h('div.section-head',
    h('h2', { text: t('home.yourBoards') }),
    h('div.row',
      btn(t('home.import'), { icon: 'upload', cls: 'btn-ghost', onclick: importFromFile }),
      btn(t('home.newBoard'), { icon: 'plus', cls: 'btn-primary', onclick: openCreate })
    )
  );
  if (!boards.length) {
    return h('section.boards',
      head,
      h('div.empty',
        h('p', { text: t('home.empty') }),
        h('div.row.center',
          btn(t('home.createFirst'), { icon: 'plus', cls: 'btn-primary btn-lg', onclick: openCreate }),
          btn(t('home.tryExample'), { icon: 'sparkle', cls: 'btn-ghost btn-lg', onclick: () => { createExamples(); render(); } })
        )
      )
    );
  }
  return h('section.boards', head, h('div.board-grid', boards.map(b => boardCard(b, render))));
}

function boardCard(b, render) {
  const sum = boardSummary(b);
  const sw = PALETTE_SWATCHES[b.palette] || [b.custom?.a, b.custom?.b];
  const more = iconBtn('more', t('common.more'), (e) => popMenu(e.currentTarget, [
    { label: t('common.rename'), icon: 'edit', onClick: async () => {
      const name = await promptDialog(t('common.rename'), { value: b.title });
      if (name) { b.title = name; store.saveBoard(b); render(); }
    } },
    { label: t('home.duplicate'), icon: 'copy', onClick: () => {
      store.saveBoard(cloneBoard(b, t('home.copyOf', { title: b.title })));
      render();
    } },
    { label: t('share.copyLink'), icon: 'link', onClick: () => copyBoardLink(b) },
    { label: t('share.export'), icon: 'download', onClick: () => downloadText(safeFilename(b.title) + '.json', exportJson([b])) },
    'sep',
    { label: t('common.delete'), icon: 'trash', danger: true, onClick: async () => {
      if (!await confirmDialog(t('home.deleteConfirm', { title: b.title }), { danger: true, okLabel: t('common.delete') })) return;
      store.deleteBoard(b.id);
      render();
    } }
  ]));

  const detail = b.mode === 'leaderboard'
    ? (sum.leader ? h('p.card-leader', { html: icon('trophy') }, h('span', { text: sum.leader.name }), h('b', { text: fmtNum(sum.leader.score) })) : null)
    : h('p.card-leader.scoreline', { text: `${b.teams[0].name}  ${sum.line}  ${b.teams[1].name}` });

  return h('article.board-card', { style: { '--c1': sw[0], '--c2': sw[1] } },
    h('a.board-card-main', { href: '#/b/' + b.id },
      h('div.card-top',
        h('span.mode-chip', { html: icon(b.mode === 'leaderboard' ? 'list' : 'ball') }, h('span', { text: t('modes.' + b.mode) })),
      ),
      h('h3', { text: b.title }),
      h('p.muted.small', { text: `${t(b.mode === 'leaderboard' ? 'home.players' : 'home.squad', { n: sum.count })} · ${fmtAgo(b.updatedAt)}` }),
      detail
    ),
    h('div.card-actions',
      iconBtn('display', t('control.openDisplay'), () => openDisplayWindow(b.id)),
      more
    )
  );
}

export function openDisplayWindow(id) {
  const w = window.open('#/display/' + id, 'punkto-display-' + id);
  if (!w) location.hash = '#/display/' + id; // popup blocked → open here
}

export async function copyBoardLink(b) {
  const link = await boardToLink(b);
  if (await copyText(link)) toast(t('share.linkCopied'), { kind: 'ok', ms: 4000 });
  else promptDialog(t('share.copyLink'), { value: link, maxLength: 100000 });
}

/* ------------------------------------------------------------ create */

export function openCreate() {
  let mode = 'leaderboard';
  let palette = 'classroom';
  const title = h('input.input', { type: 'text', maxLength: 80, placeholder: t('create.titlePlaceholder'), autofocus: true, 'aria-label': t('create.title') });

  const cards = h('div.mode-cards', { role: 'radiogroup', 'aria-label': t('create.mode') },
    [['leaderboard', leaderboardArt], ['scoreboard', scoreboardArt]].map(([m, art]) =>
      h('button.mode-card', {
        role: 'radio', 'aria-checked': String(m === mode), class: m === mode ? 'on' : '', dataset: { mode: m },
        onclick: (e) => {
          mode = m;
          cards.querySelectorAll('.mode-card').forEach(c => { const on = c === e.currentTarget; c.classList.toggle('on', on); c.setAttribute('aria-checked', String(on)); });
        },
        html: art
      }, h('strong', { text: t('modes.' + m) }), h('span.small.muted', { text: t('modes.' + m + 'Desc') }))
    ));

  const pals = h('div.swatches', { role: 'radiogroup', 'aria-label': t('settings.palette') },
    Object.entries(PALETTE_SWATCHES).map(([p, [a, b2, bg]]) => h('button.swatch', {
      role: 'radio', 'aria-checked': String(p === palette), class: p === palette ? 'on' : '', title: t('palettes.' + p),
      style: { '--a': a, '--b': b2, '--bg': bg },
      onclick: (e) => {
        palette = p;
        pals.querySelectorAll('.swatch').forEach(s => { const on = s === e.currentTarget; s.classList.toggle('on', on); s.setAttribute('aria-checked', String(on)); });
      }
    }, h('span.swatch-dots'), h('span.swatch-name', { text: t('palettes.' + p) }))));

  modal({
    title: t('create.heading'),
    wide: true,
    content: h('div.stack',
      h('label.field', h('span.field-label', { text: t('create.title') }), title),
      h('div.field', h('span.field-label', { text: t('create.mode') }), cards),
      h('div.field', h('span.field-label', { text: t('settings.palette') }), pals)
    ),
    actions: [
      { label: t('common.cancel'), kind: 'ghost' },
      { label: t('create.create'), kind: 'primary', onClick: () => {
        const b = newBoard(mode, title.value.trim() || t('modes.' + mode), palette);
        if (mode === 'scoreboard') { b.teams[0].name = t('sb.home'); b.teams[1].name = t('sb.away'); }
        store.saveBoard(b);
        location.hash = '#/b/' + b.id;
      } }
    ]
  });
}

function createExamples() {
  const quiz = newBoard('leaderboard', t('examples.quiz'), 'pub');
  const teams = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
  const rounds = [[8, 7, 9], [6, 9, 8], [9, 5, 7], [7, 8, 6], [5, 6, 9]];
  quiz.players = teams.map((n, i) => ({ ...newPlayer(n), scores: rounds[i] }));
  quiz.round = 2; quiz.roundCount = 3; quiz.showRounds = false; quiz.steps = [1, 2];

  const match = newBoard('scoreboard', t('examples.match'), 'sports');
  match.teams[0].name = t('sb.home'); match.teams[1].name = t('sb.away');
  match.teams[0].players = ['Alex', 'Sam', 'Kim', 'Luca'].map(n => newPlayer(n)).map(({ id, name }) => ({ id, name }));
  match.teams[1].players = ['Max', 'Robin', 'Noa', 'Jo'].map(n => newPlayer(n)).map(({ id, name }) => ({ id, name }));
  addGoal(match, match.teams[0].id, match.teams[0].players[1].id);
  addGoal(match, match.teams[1].id, match.teams[1].players[0].id);
  addGoal(match, match.teams[0].id, match.teams[0].players[3].id);

  store.saveBoard(match);
  store.saveBoard(quiz);
  toast(t('home.examplesAdded'), { kind: 'ok' });
}

/* ------------------------------------------------------ SEO content */

function features() {
  const items = [['users', 'f1'], ['trophy', 'f2'], ['display', 'f3'], ['shield', 'f4']];
  return h('section.features', { 'aria-label': t('home.featuresTitle') },
    h('h2', { text: t('home.featuresTitle') }),
    h('div.feature-grid', items.map(([ic, k]) => h('div.feature', { html: icon(ic) },
      h('h3', { text: t('home.' + k + 'Title') }),
      h('p', { text: t('home.' + k + 'Text') })
    )))
  );
}

function faq() {
  return h('section.faq',
    h('h2', { text: t('faq.title') }),
    ['q1', 'q2', 'q3', 'q4', 'q5'].map(k => h('details',
      h('summary', { text: t('faq.' + k) }),
      h('p', { text: t('faq.a' + k.slice(1)) })
    ))
  );
}
