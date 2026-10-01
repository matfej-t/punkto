// Optional, cookie-free statistics with GoatCounter (https://www.goatcounter.com).
// Nothing is loaded unless config.js → analytics.goatcounter is set.
// Page views are counted automatically; track() records a few anonymous
// events (e.g. "board-created-leaderboard") so you can see what people use.

const url = window.PUNKTO_CONFIG.analytics?.goatcounter || '';
export const analyticsOn = /^https:\/\/[\w.-]+\/count$/.test(url);

export function initAnalytics() {
  if (!analyticsOn || document.querySelector('script[data-goatcounter]')) return;
  const s = document.createElement('script');
  s.async = true;
  s.dataset.goatcounter = url;
  s.src = 'https://gc.zgo.at/count.js';
  document.head.append(s);
}

/** Count an anonymous event. Safe to call anytime; does nothing when statistics are off. */
export function track(name) {
  if (!analyticsOn) return;
  const send = () => window.goatcounter?.count?.({ path: name, title: name, event: true });
  if (window.goatcounter?.count) send();
  else setTimeout(send, 2500); // the script may still be loading
}
