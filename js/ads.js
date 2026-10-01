// Ad slots (Google AdSense).
//
// Placement rules used throughout the app:
//   • Control view: ONE responsive slot at the very bottom of the page,
//     below the footer spacer, far away from score buttons.
//   • Display view: ONE small fixed 320×50 slot in the bottom-right corner.
//   • No ads on the home screen, in dialogs, or next to any button.
//   • Premium users and "Hide ads" (per session) get no ad code at all.
//
// Configure your publisher ID and slot IDs in config.js — no HTML editing
// needed. The <ins class="adsbygoogle"> tags are created right here.
import { h } from './ui.js';
import { t } from './i18n.js';
import { isPremium, adsHiddenForSession } from './premium.js';
import { params } from './env.js';

const cfg = window.PUNKTO_CONFIG.ads;
let scriptLoaded = false;

const preview = () => cfg.showPlaceholders || params.has('adpreview');
const configured = () => !!cfg.adsenseClient;

/** Are ads shown at all for this visitor right now? */
export function adsActive() {
  return !!cfg.enabled && !isPremium() && !adsHiddenForSession() && (configured() || preview());
}

function loadScript() {
  if (scriptLoaded) return;
  scriptLoaded = true;
  // ===== Google AdSense loader =====
  // Equivalent to the snippet AdSense gives you:
  // <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.adsenseClient)}`;
  document.head.append(s);
}

/**
 * Create an ad slot element. kind: 'control' | 'display'.
 * Returns null when no ad should be shown (caller simply skips it).
 */
export function adSlot(kind) {
  if (!adsActive()) return null;
  const slotId = cfg.slots?.[kind];
  if (!(configured() && slotId) && !preview()) return null;
  const wrap = h('aside.ad-slot', { class: 'ad-' + kind, 'aria-label': t('ads.label') },
    h('span.ad-label', { text: t('ads.label') }));

  if (configured() && slotId) {
    loadScript();
    // ===== Google AdSense ad unit =====
    // The <ins> below is the ad unit from AdSense → Ads → By ad unit.
    const ins = kind === 'display'
      ? h('ins.adsbygoogle', { style: { display: 'inline-block', width: '320px', height: '50px' } })
      : h('ins.adsbygoogle', { style: { display: 'block' } });
    ins.dataset.adClient = cfg.adsenseClient;
    ins.dataset.adSlot = slotId;
    if (kind !== 'display') {
      ins.dataset.adFormat = 'horizontal';
      ins.dataset.fullWidthResponsive = 'true';
    }
    wrap.append(ins);
    // Push after the element is in the DOM (next frame).
    requestAnimationFrame(() => {
      if (!ins.isConnected) return;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ad blockers */ }
    });
  } else {
    // Placeholder box (preview mode or slot ID not configured yet).
    wrap.append(h('div.ad-placeholder', { text: kind === 'display' ? 'Ad 320×50' : 'Ad · responsive banner' }));
  }
  return wrap;
}
