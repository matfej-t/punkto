// Small DOM toolkit: element builder, dialogs, toasts, popover menus.
import { icon } from './icons.js';
import { t } from './i18n.js';

/**
 * h('button.btn.primary', { onclick, title }, 'Text', childNode)
 * Tag string supports .classes and #id. Props:
 *   class, text, html (trusted markup only, e.g. icons), style (object),
 *   dataset (object), on<event> (function), any other → attribute/property.
 */
export function h(tag, props = {}, ...children) {
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9-]*)(.*)$/i);
  const el = document.createElement(name || 'div');
  if (name === 'button') el.type = 'button'; // never submit forms by accident
  for (const m of rest.matchAll(/([.#])([\w-]+)/g)) {
    if (m[1] === '.') el.classList.add(m[2]); else el.id = m[2];
  }
  if (props == null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) {
    children.unshift(props);
    props = {};
  }
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') String(v).split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
      }
    }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

/** replaceChildren() that skips null/false (the DOM would print "null"). */
export function fill(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Icon-only button with an accessible label + tooltip. */
export function iconBtn(name, label, onclick, cls = '') {
  return h('button.btn.icon-btn', { type: 'button', class: cls, title: label, 'aria-label': label, onclick, html: icon(name) });
}

/** Button with icon + text. */
export function btn(label, { icon: ic, cls = '', onclick, type = 'button', title } = {}) {
  const b = h('button.btn', { type, class: cls, onclick, title });
  if (ic) b.insertAdjacentHTML('beforeend', icon(ic));
  b.append(h('span', { text: label }));
  return b;
}

/**
 * Re-render a container while keeping keyboard focus and caret position.
 * Elements that should keep focus need a stable data-key attribute.
 */
export function rerender(container, build) {
  const a = document.activeElement;
  const key = a && container.contains(a) ? a.dataset.key : null;
  let sel = null;
  if (key && 'selectionStart' in a) { try { sel = [a.selectionStart, a.selectionEnd]; } catch { /* not text */ } }
  const scroll = [...container.querySelectorAll('[data-scroll-key]')].map(e => [e.dataset.scrollKey, e.scrollLeft, e.scrollTop]);
  container.replaceChildren(...[build()].flat().filter(Boolean));
  for (const [k, l, tp] of scroll) {
    const e = container.querySelector(`[data-scroll-key="${k}"]`);
    if (e) { e.scrollLeft = l; e.scrollTop = tp; }
  }
  if (key) {
    const n = container.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (n) {
      n.focus({ preventScroll: true });
      if (sel) { try { n.setSelectionRange(...sel); } catch { /* ignore */ } }
    }
  }
}

/* ---------------------------------------------------------------- dialogs */

/**
 * Open a modal dialog. Returns { el, body, close }.
 * actions: [{ label, kind: 'primary'|'danger'|'ghost', onClick(close) → false keeps open }]
 */
export function modal({ title, content, actions = [], wide = false, onClose, cls = '' }) {
  const dlg = h('dialog.modal', { class: [wide ? 'wide' : '', cls].join(' '), 'aria-label': title || '' });
  const body = h('div.modal-body');
  const close = (result) => {
    if (!dlg.open) return;
    dlg.close();
    dlg.remove();
    onClose?.(result);
  };
  const head = h('div.modal-head',
    h('h2.modal-title', { text: title || '' }),
    iconBtn('close', t('common.close'), () => close())
  );
  append(body, [content]);
  const foot = actions.length ? h('div.modal-foot', actions.map(a =>
    h('button.btn', {
      type: a.submit ? 'submit' : 'button',
      class: a.kind ? 'btn-' + a.kind : '',
      text: a.label,
      onclick: async (e) => {
        e.preventDefault();
        const r = await a.onClick?.(close);
        if (r !== false) close(a.value);
      }
    })
  )) : null;
  dlg.append(h('form.modal-card', { method: 'dialog', onsubmit: e => {
    e.preventDefault();
    // Enter in a text field triggers the primary action.
    dlg.querySelector('.modal-foot .btn-primary')?.click();
  } }, head, body, foot));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  // Click on the backdrop closes the dialog.
  dlg.addEventListener('mousedown', (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
  const first = dlg.querySelector('[autofocus]') || dlg.querySelector('.modal-body input, .modal-body select, .modal-body textarea');
  first?.focus();
  return { el: dlg, body, close };
}

export function confirmDialog(message, { title, okLabel, danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    modal({
      title: title || t('common.areYouSure'),
      content: h('p', { text: message }),
      actions: [
        { label: t('common.cancel'), kind: 'ghost', onClick: () => { done = true; resolve(false); } },
        { label: okLabel || t('common.ok'), kind: danger ? 'danger' : 'primary', onClick: () => { done = true; resolve(true); } }
      ],
      onClose: () => { if (!done) resolve(false); }
    });
  });
}

export function promptDialog(title, { value = '', placeholder = '', okLabel, maxLength = 80 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const input = h('input.input', { type: 'text', value, placeholder, maxLength, autofocus: true });
    modal({
      title,
      content: input,
      actions: [
        { label: t('common.cancel'), kind: 'ghost', onClick: () => { done = true; resolve(null); } },
        { label: okLabel || t('common.save'), kind: 'primary', onClick: () => { done = true; resolve(input.value.trim()); } }
      ],
      onClose: () => { if (!done) resolve(null); }
    });
    input.select();
  });
}

/* ----------------------------------------------------------------- toasts */

let toastHost;
export function toast(message, { kind = '', ms = 2600 } = {}) {
  if (!toastHost) {
    toastHost = h('div.toasts', { role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const el = h('div.toast', { class: kind, text: message });
  toastHost.append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}

/* ------------------------------------------------------------------ menus */

/** Popover menu anchored to a button. items: [{ label, icon, onClick, danger }] or 'sep'. */
export function popMenu(anchor, items) {
  closeMenus();
  const menu = h('div.menu', { role: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it === 'sep') { menu.append(h('div.menu-sep')); continue; }
    const b = h('button.menu-item', { type: 'button', role: 'menuitem', class: it.danger ? 'danger' : '' });
    if (it.icon) b.insertAdjacentHTML('beforeend', icon(it.icon));
    b.append(h('span', { text: it.label }));
    if (it.hint) b.append(h('kbd', { text: it.hint }));
    b.addEventListener('click', () => { closeMenus(); it.onClick?.(); });
    menu.append(b);
  }
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = Math.min(r.right - mw, innerWidth - mw - 8);
  left = Math.max(8, left);
  let top = r.bottom + 6;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.querySelector('button')?.focus();
  setTimeout(() => {
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', esc, true);
  });
  function outside(e) { if (!menu.contains(e.target)) closeMenus(); }
  function esc(e) {
    if (e.key === 'Escape') { e.stopPropagation(); closeMenus(); anchor.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const btns = [...menu.querySelectorAll('button')];
      const i = btns.indexOf(document.activeElement);
      btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]?.focus();
    }
  }
  menu._cleanup = () => {
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('keydown', esc, true);
  };
}

export function closeMenus() {
  document.querySelectorAll('.menu').forEach(m => { m._cleanup?.(); m.remove(); });
}

/** Read a File chosen by the user via a hidden <input type=file>. */
export function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
    inp.addEventListener('change', () => { resolve(inp.files[0] || null); inp.remove(); });
    document.body.append(inp);
    inp.click();
  });
}

/** Trigger a file download of text content. */
export function downloadText(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / insecure contexts.
    const ta = h('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Avatar: coloured circle with the name's initials. */
export function avatar(name, cls = '') {
  const initials = String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => [...w][0] || '').join('').toUpperCase() || '?';
  return h('span.avatar.initials', { class: cls, text: initials, style: { '--hue': hashHue(name) }, 'aria-hidden': 'true' });
}

export function hashHue(s) {
  let x = 0;
  for (const c of String(s || '')) x = (x * 31 + c.codePointAt(0)) >>> 0;
  return String(x % 360);
}
