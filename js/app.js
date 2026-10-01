// Punkto — app bootstrap and hash router.
//
// Routes:
//   #/                     home (list of boards)
//   #/b/<id>               control view (host edits scores)
//   #/display/<id>         display view (TV / projector)
//   #/winner/<id>/<entry>  winner screen of a finished game
//   #/import/<payload>     restore a board from a shared link
//   #/privacy              privacy information
import { setLang, detectLang, t, getLang } from './i18n.js';
import * as store from './store.js';
import { initTheme, applyScheme } from './theme.js';
import { toast, closeMenus } from './ui.js';
import { revalidateInBackground, hideAdsForSession } from './premium.js';
import { ROOT_URL } from './env.js';
import { homeView } from './views/home.js';
import { controlView } from './views/control.js';
import { displayView } from './views/display.js';
import { winnerView } from './views/winner.js';
import { privacyView, importView } from './views/common.js';

const app = document.getElementById('app');
let current = null;

const routes = [
  [/^#?\/?$/, homeView],
  [/^#\/b\/([\w-]+)\/?$/, controlView],
  [/^#\/display\/([\w-]+)\/?$/, displayView],
  [/^#\/winner\/([\w-]+)\/([\w-]+)\/?$/, winnerView],
  [/^#\/import\/([\w-]+)$/, importView],
  [/^#\/privacy\/?$/, privacyView]
];

export function route() {
  try { current?.destroy?.(); } catch (e) { console.error(e); }
  current = null;
  closeMenus();
  document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); });
  document.body.className = '';
  const hash = location.hash || '#/';
  for (const [re, view] of routes) {
    const m = hash.match(re);
    if (m) {
      app.replaceChildren();
      current = view(app, ...m.slice(1)) || null;
      if (!hash.startsWith('#/display')) window.scrollTo(0, 0);
      return;
    }
  }
  location.replace('#/');
}

/** Re-render the current view in place (keeps view state when supported). */
export function refresh() {
  if (current?.refresh) current.refresh();
  else route();
}

async function onRemote(msg) {
  switch (msg.type) {
    case 'settings': {
      applyScheme();
      const s = store.getSettings();
      if (s.lang && s.lang !== getLang()) { await setLang(s.lang); refresh(); }
      else current?.onEvent?.(msg);
      break;
    }
    case 'ads-hidden':
      hideAdsForSession(true);
      refresh();
      break;
    case 'license':
      refresh();
      break;
    default:
      current?.onEvent?.(msg);
  }
}

async function boot() {
  initTheme(() => current?.onEvent?.({ type: 'scheme' }));
  store.onStorageError(() => toast(t('errors.storageFull'), { kind: 'error', ms: 7000 }));
  await setLang(detectLang(store.getSettings().lang));
  store.onChange(onRemote);
  window.addEventListener('hashchange', route);
  route();
  revalidateInBackground();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const reg = () => navigator.serviceWorker.register(new URL('sw.js', ROOT_URL)).catch(e => console.warn('SW', e));
  if (document.readyState === 'complete') reg();
  else window.addEventListener('load', reg);
}

boot();
