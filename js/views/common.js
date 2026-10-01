// Shared UI pieces: app bar, language switcher, settings & premium dialogs,
// privacy page, restore-from-link page, footer.
import { h, iconBtn, btn, modal, toast, confirmDialog, downloadText, pickFile } from '../ui.js';
import { icon } from '../icons.js';
import { t, LANGS, LANG_NAMES, getLang, setLang, langUrl, fmtNum } from '../i18n.js';
import * as store from '../store.js';
import { toggleScheme, resolvedScheme, setThemePref } from '../theme.js';
import { isPremium, getLicense, activateLicense, removeLicense, hideAdsForSession, maskKey } from '../premium.js';
import { adsActive } from '../ads.js';
import { exportJson, parseImport, prepareImported, linkToBoard } from '../share.js';
import { parseSteps } from '../model.js';
import { APP_VERSION } from '../env.js';

const cfg = window.PUNKTO_CONFIG;

/** Re-run the router (used after language/premium changes). */
export function reroute() { window.dispatchEvent(new HashChangeEvent('hashchange')); }

export const logoSvg = `<svg viewBox="0 0 512 512" class="logo" aria-hidden="true"><rect width="512" height="512" rx="120" fill="var(--accent)"/><path d="M190 386V136h88a78 78 0 0 1 0 156h-88" fill="none" stroke="var(--accent-ink)" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/><circle cx="356" cy="372" r="38" fill="var(--gold)"/></svg>`;

/* --------------------------------------------------------- point buttons */

/**
 * Text field for the point buttons, e.g. "1, 5" → [1, 5].
 * onChange receives the parsed list; invalid input snaps back to the last valid value.
 */
export function stepsInput(initial, onChange) {
  let current = [...initial];
  const input = h('input.input', {
    type: 'text', value: current.join(', '), inputMode: 'numeric', 'aria-label': t('settings.steps'),
    onchange: () => {
      const s = parseSteps(input.value);
      if (s.length) { current = s; onChange(s); }
      input.value = current.join(', ');
    }
  });
  /** Replace the value programmatically (used when the board type changes). */
  input.setSteps = (s) => { current = [...s]; input.value = current.join(', '); };
  input.getSteps = () => { const s = parseSteps(input.value); return s.length ? s : current; };
  return input;
}

/* ------------------------------------------------------------- language */

export async function changeLang(code) {
  store.setSettings({ lang: code });
  await setLang(code);
  try { history.replaceState(null, '', langUrl(code).href + location.hash); } catch { /* file:// */ }
  reroute();
}

export function langSelect() {
  const sel = h('select.lang-select-input', { 'aria-label': t('settings.language'), onchange: e => changeLang(e.target.value) },
    LANGS.map(c => h('option', { value: c, text: LANG_NAMES[c] || c, selected: c === getLang() })));
  return h('label.lang-select', { title: t('settings.language'), html: icon('globe') }, sel);
}

export function themeBtn(after) {
  const b = iconBtn(resolvedScheme() === 'dark' ? 'sun' : 'moon', t('settings.toggleTheme'), () => {
    toggleScheme();
    b.innerHTML = icon(resolvedScheme() === 'dark' ? 'sun' : 'moon');
    after?.();
  });
  return b;
}

/* --------------------------------------------------------------- app bar */

export function appBar({ extra = [] } = {}) {
  return h('header.appbar',
    h('a.brand', { href: '#/', html: logoSvg }, h('span', { text: 'Punkto' })),
    h('div.spacer'),
    ...extra,
    langSelect(),
    themeBtn(),
    iconBtn('settings', t('settings.title'), openSettings)
  );
}

export function footer() {
  return h('footer.site-footer',
    h('nav.footer-links',
      h('a', { href: '#/privacy', text: t('footer.privacy') }),
      h('button.linklike', { text: isPremium() ? t('premium.activeShort') : t('premium.adFree'), onclick: openPremium }),
      h('span.muted', { text: t('footer.noTracking') })
    ),
    h('nav.footer-langs', { 'aria-label': t('settings.language') },
      LANGS.map(c => h('a', { href: langUrl(c).href, hreflang: c, lang: c, text: LANG_NAMES[c], onclick: (e) => { e.preventDefault(); changeLang(c); } }))
    ),
    h('p.muted.small', { text: `Punkto ${APP_VERSION}` })
  );
}

/* -------------------------------------------------------------- settings */

export function openSettings() {
  const pref = store.getSettings().theme;
  const seg = h('div.segmented', { role: 'radiogroup', 'aria-label': t('settings.theme') },
    ['auto', 'light', 'dark'].map(v => h('button', {
      class: v === pref ? 'on' : '', role: 'radio', 'aria-checked': String(v === pref), text: t('settings.theme_' + v),
      onclick: (e) => {
        setThemePref(v);
        seg.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-checked', String(b === e.currentTarget)); });
      }
    })));

  const used = store.storageUsage();
  const pct = Math.min(100, Math.round(used / (5 * 1024 * 1024) * 100));
  const content = h('div.stack',
    h('div.field', h('span.field-label', { text: t('settings.language') }), langSelect()),
    h('div.field', h('span.field-label', { text: t('settings.theme') }), seg),
    h('div.field',
      h('span.field-label', { text: t('premium.title') }),
      h('div.row',
        h('span', { class: isPremium() ? 'pill ok' : 'pill', text: isPremium() ? t('premium.activeShort') : t('premium.free') }),
        btn(isPremium() ? t('common.manage') : t('premium.adFree'), { icon: 'sparkle', cls: 'btn-ghost', onclick: () => { m.close(); openPremium(); } })
      )
    ),
    h('div.field',
      h('span.field-label', { text: t('settings.data') }),
      h('p.small.muted', { text: t('settings.dataHint') }),
      h('div.row.wrap',
        btn(t('settings.exportAll'), { icon: 'download', cls: 'btn-ghost', onclick: exportAll }),
        btn(t('settings.import'), { icon: 'upload', cls: 'btn-ghost', onclick: () => { m.close(); importFromFile(); } })
      ),
      h('div.meter', { title: `${pct}%` }, h('div.meter-fill', { style: { width: Math.max(2, pct) + '%' } })),
      h('p.small.muted', { text: t('settings.storage', { used: fmtNum(Math.round(used / 1024)), total: fmtNum(5120) }) })
    ),
    h('div.field',
      h('div.row.wrap',
        h('a.btn.btn-ghost', { href: '#/privacy', onclick: () => m.close(), html: icon('shield') }, h('span', { text: t('footer.privacy') })),
        btn(t('settings.wipe'), {
          icon: 'trash', cls: 'btn-ghost danger-text', onclick: async () => {
            if (!await confirmDialog(t('settings.wipeConfirm'), { danger: true, okLabel: t('settings.wipe') })) return;
            store.wipeAll();
            m.close();
            location.hash = '#/';
            reroute();
          }
        })
      )
    ),
    h('p.small.muted', { text: `Punkto ${APP_VERSION}` })
  );
  const m = modal({ title: t('settings.title'), content, actions: [{ label: t('common.done'), kind: 'primary' }] });
}

export function exportAll() {
  const boards = store.listBoards();
  if (!boards.length) { toast(t('home.empty')); return; }
  downloadText(`punkto-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJson(boards));
}

export async function importFromFile() {
  const file = await pickFile('application/json,.json');
  if (!file) return;
  try {
    const boards = parseImport(await file.text());
    const ids = new Set(store.listBoards().map(b => b.id));
    for (const b of boards) { prepareImported(b, ids); ids.add(b.id); store.saveBoard(b, { touch: false }); }
    toast(t('share.imported', { n: boards.length }), { kind: 'ok' });
    reroute();
  } catch (e) {
    console.warn(e);
    toast(t('errors.badFile'), { kind: 'error' });
  }
}

/* --------------------------------------------------------------- premium */

export function openPremium() {
  const content = h('div.stack');
  const m = modal({ title: t('premium.title'), content, cls: 'premium-modal' });

  if (isPremium()) {
    const lic = getLicense();
    content.append(
      h('div.premium-ok', { html: icon('check') }, h('strong', { text: t('premium.active') })),
      h('p.muted', { text: t('premium.thanks') }),
      h('p.small.muted', { text: `${t('premium.key')}: ${maskKey(lic.key)}` }),
      btn(t('premium.remove'), {
        cls: 'btn-ghost', onclick: async () => {
          if (!await confirmDialog(t('premium.removeConfirm'))) return;
          await removeLicense();
          m.close();
          reroute();
        }
      })
    );
    return;
  }

  const status = h('p.small', { role: 'status' });
  const input = h('input.input', { type: 'text', placeholder: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX', autocomplete: 'off', spellcheck: false, 'aria-label': t('premium.key') });
  const activateBtn = btn(t('premium.activate'), {
    cls: 'btn-primary', onclick: async () => {
      if (!input.value.trim()) { input.focus(); return; }
      activateBtn.disabled = true;
      status.className = 'small muted';
      status.textContent = t('premium.checking');
      try {
        await activateLicense(input.value);
        toast(t('premium.active'), { kind: 'ok' });
        m.close();
        reroute();
      } catch (e) {
        status.className = 'small error-text';
        status.textContent = t('premium.err_' + (e.code || 'invalid'));
      } finally {
        activateBtn.disabled = false;
      }
    }
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); activateBtn.click(); } });

  content.append(
    h('ul.benefits', ['b1', 'b2', 'b3', 'b4'].map(k => h('li', { html: icon('check') }, h('span', { text: t('premium.' + k) })))),
    h('a.btn.btn-primary.btn-lg.block', { href: cfg.premium.checkoutUrl, target: '_blank', rel: 'noopener', html: icon('sparkle') },
      h('span', { text: t('premium.buy', { price: cfg.premium.priceLabel }) })),
    h('p.small.muted.center', { text: t('premium.payments') }),
    h('div.divider'),
    h('label.field-label', { text: t('premium.haveKey') }),
    h('div.row', input, activateBtn),
    status
  );

  if (adsActive()) {
    content.append(
      h('div.divider'),
      h('div.row.space',
        h('div', h('strong', { text: t('premium.hideSession') }), h('p.small.muted', { text: t('premium.hideSessionHint') })),
        btn(t('premium.hideSessionBtn'), { cls: 'btn-ghost', onclick: () => { hideAdsForSession(); m.close(); reroute(); } })
      )
    );
  }
}

/* ---------------------------------------------------------------- privacy */

export function privacyView(root) {
  document.title = `${t('privacy.title')} · Punkto`;
  const paras = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => h('p', { text: t('privacy.' + k) }));
  root.append(
    appBar(),
    h('main.page.prose',
      h('a.back-link', { href: '#/', html: icon('back') }, h('span', { text: t('common.back') })),
      h('h1', { text: t('privacy.title') }),
      ...paras,
      cfg.contactEmail ? h('p', {}, t('privacy.contact') + ' ', h('a', { href: 'mailto:' + cfg.contactEmail, text: cfg.contactEmail })) : null
    ),
    footer()
  );
}

/* ------------------------------------------------------- restore from link */

export function importView(root, payload) {
  root.append(appBar(), h('main.page', h('p.muted.center', { text: t('share.reading') })));
  linkToBoard(payload).then((board) => {
    const n = board.mode === 'leaderboard' ? board.players.length : board.teams.reduce((a, x) => a + x.players.length, 0);
    let done = false;
    modal({
      title: t('share.restoreTitle'),
      content: h('div.stack',
        h('p', {}, t('share.restoreText') + ' ', h('strong', { text: board.title })),
        h('p.small.muted', { text: `${t('modes.' + board.mode)} · ${t('home.players', { n })}` }),
        h('p.small.muted', { text: t('share.noImages') })
      ),
      actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        {
          label: t('share.restore'), kind: 'primary', onClick: () => {
            done = true;
            prepareImported(board, new Set(store.listBoards().map(b => b.id)));
            store.saveBoard(board);
            location.replace('#/b/' + board.id);
          }
        }
      ],
      onClose: () => { if (!done) location.replace('#/'); }
    });
  }).catch((e) => {
    console.warn(e);
    toast(t('errors.badLink'), { kind: 'error' });
    location.replace('#/');
  });
}
