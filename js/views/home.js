// Home screen: intro + privacy note, saved boards, create dialog, FAQ.
import { h, btn, iconBtn, modal, popMenu, promptDialog, confirmDialog, toast, copyText, downloadText, rerender } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtAgo, fmtNum } from '../i18n.js';
import * as store from '../store.js';
import { newBoard, cloneBoard, boardSummary, DEFAULT_STEPS } from '../model.js';
import { leaderboardArt, scoreboardArt } from '../illustrations.js';
import { boardToLink, exportJson, safeFilename } from '../share.js';
import { appBar, footer, importFromFile, stepsInput } from './common.js';

export function homeView(root) {
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
          btn(t('home.createFirst'), { icon: 'plus', cls: 'btn-primary btn-lg', onclick: openCreate })
        )
      )
    );
  }
  return h('section.boards', head, h('div.board-grid', boards.map(b => boardCard(b, render))));
}

function boardCard(b, render) {
  const sum = boardSummary(b);
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

  return h('article.board-card',
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
  const steps = stepsInput(DEFAULT_STEPS, () => {});
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

  modal({
    title: t('create.heading'),
    wide: true,
    content: h('div.stack',
      h('label.field', h('span.field-label', { text: t('create.title') }), title),
      h('div.field', h('span.field-label', { text: t('create.mode') }), cards),
      h('label.field', h('span.field-label', { text: t('settings.steps') }), steps, h('span.small.muted', { text: t('settings.stepsHint') }))
    ),
    actions: [
      { label: t('common.cancel'), kind: 'ghost' },
      { label: t('create.create'), kind: 'primary', onClick: () => {
        const b = newBoard(mode, title.value.trim() || t('modes.' + mode), steps.getSteps());
        if (mode === 'scoreboard') { b.teams[0].name = t('sb.home'); b.teams[1].name = t('sb.away'); }
        store.saveBoard(b);
        location.hash = '#/b/' + b.id;
      } }
    ]
  });
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
