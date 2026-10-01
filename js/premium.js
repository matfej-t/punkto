// Premium (ad-free) license handling via the Lemon Squeezy License API.
//
// Flow: the buyer pays on the Lemon Squeezy checkout page, receives a
// license key by e-mail, pastes it into Punkto. We call
//   POST https://api.lemonsqueezy.com/v1/licenses/activate
// directly from the browser. The request is a CORS "simple request"
// (form-encoded body, only the Accept header) so no preflight is needed.
// If your deployment can't reach the API directly, set
// config.premium.licenseProxyUrl (see tools/license-proxy-worker.js).
import { readRaw, writeRaw, removeRaw, broadcast } from './store.js';

const cfg = window.PUNKTO_CONFIG.premium;
const SESSION_KEY = 'punkto:hideAds';

export function getLicense() { return readRaw('license', null); }

export function isPremium() {
  const l = getLicense();
  return !!(l && l.key && l.status !== 'disabled' && l.status !== 'expired');
}

/* ---------------------------------------------------- free session hide */
export function adsHiddenForSession() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}
export function hideAdsForSession(fromRemote = false) {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* private mode */ }
  if (!fromRemote) broadcast({ type: 'ads-hidden' });
}

/* ---------------------------------------------------------- license API */

function endpoint(action) {
  const base = (cfg.licenseProxyUrl || cfg.licenseApi).replace(/\/+$/, '');
  return `${base}/${action}`;
}

async function call(action, params) {
  let res;
  try {
    res = await fetch(endpoint(action), {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new URLSearchParams(params)
    });
  } catch {
    // Network down, blocked by an extension, or CORS rejected.
    const e = new Error('network');
    e.code = 'network';
    throw e;
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data };
}

function productMatches(meta = {}) {
  if (cfg.expectedStoreId != null && Number(meta.store_id) !== Number(cfg.expectedStoreId)) return false;
  if (cfg.expectedProductId != null && Number(meta.product_id) !== Number(cfg.expectedProductId)) return false;
  return true;
}

/**
 * Activate (or validate) a key. Resolves with the stored license, or throws
 * an Error whose .code is 'network' | 'invalid' | 'limit' | 'product'.
 */
export async function activateLicense(rawKey) {
  const key = String(rawKey).trim();
  if (!/^[A-Za-z0-9-]{8,}$/.test(key)) { const e = new Error('invalid'); e.code = 'invalid'; throw e; }

  const useActivate = cfg.mode !== 'validate';
  const r = useActivate
    ? await call('activate', { license_key: key, instance_name: instanceName() })
    : await call('validate', { license_key: key });
  const d = r.data || {};
  const success = useActivate ? d.activated === true : d.valid === true;
  if (!success) {
    const msg = String(d.error || '');
    const e = new Error(msg || 'invalid');
    e.code = /limit/i.test(msg) ? 'limit' : 'invalid';
    throw e;
  }
  if (!productMatches(d.meta)) {
    // A valid key, but for someone else's product: undo the activation.
    if (useActivate && d.instance?.id) call('deactivate', { license_key: key, instance_id: d.instance.id }).catch(() => {});
    const e = new Error('product'); e.code = 'product'; throw e;
  }
  const lic = {
    key,
    instanceId: d.instance?.id || null,
    status: d.license_key?.status || 'active',
    productName: d.meta?.product_name || '',
    activatedAt: Date.now(),
    lastCheck: Date.now()
  };
  writeRaw('license', lic);
  broadcast({ type: 'license' });
  return lic;
}

/** Remove the license from this browser (frees the activation slot when possible). */
export async function removeLicense() {
  const l = getLicense();
  removeRaw('license');
  broadcast({ type: 'license' });
  if (l?.instanceId) {
    try { await call('deactivate', { license_key: l.key, instance_id: l.instanceId }); } catch { /* offline: fine */ }
  }
}

/**
 * Re-check a stored license every `revalidateDays`. Only an explicit answer
 * from Lemon Squeezy (disabled / expired / unknown key, e.g. after a refund)
 * removes premium — being offline never does.
 */
export async function revalidateInBackground() {
  const l = getLicense();
  if (!l || !navigator.onLine) return;
  const due = (Date.now() - (l.lastCheck || 0)) > (cfg.revalidateDays || 30) * 86400000;
  if (!due) return;
  try {
    const params = { license_key: l.key };
    if (l.instanceId) params.instance_id = l.instanceId;
    const r = await call('validate', params);
    const d = r.data || {};
    const status = d.license_key?.status;
    if (d.valid === true) {
      writeRaw('license', { ...l, status: status || 'active', lastCheck: Date.now() });
    } else if (status === 'disabled' || status === 'expired' || (r.status === 404 && /license/i.test(d.error || ''))) {
      removeRaw('license');
      broadcast({ type: 'license' });
    }
  } catch { /* offline or blocked: try again next time */ }
}

function instanceName() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? (/(iPhone|iPad)/.test(ua) ? 'iOS' : 'macOS') : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : '';
  return `Punkto · ${browser}${os ? ' · ' + os : ''} · ${new Date().toISOString().slice(0, 10)}`;
}

export function maskKey(key) {
  return key.length > 8 ? key.slice(0, 4) + '…' + key.slice(-4) : key;
}
