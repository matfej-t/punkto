// Optional Cloudflare Worker: CORS proxy for the Lemon Squeezy License API.
//
// You only need this if license activation in the browser fails with
// "Couldn't reach the license server" even though you are online
// (i.e. Lemon Squeezy stops sending CORS headers for browser requests).
//
// Deploy (free plan is plenty):
//   1. https://dash.cloudflare.com → Workers & Pages → Create → Worker
//   2. Replace the code with this file, set ALLOWED_ORIGIN below, Deploy.
//   3. Put the worker URL into config.js → premium.licenseProxyUrl
//      e.g. "https://punkto-license.yourname.workers.dev"
//
// The worker forwards only the three public, key-less License API calls
// (activate / validate / deactivate). No API key or secret is involved.

const ALLOWED_ORIGIN = 'https://punkto.example'; // your site's origin, no trailing slash
const UPSTREAM = 'https://api.lemonsqueezy.com/v1/licenses/';
const ACTIONS = new Set(['activate', 'validate', 'deactivate']);

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const action = new URL(request.url).pathname.replace(/^\/+|\/+$/g, '');
    if (request.method !== 'POST' || !ACTIONS.has(action)) {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const body = await request.text();
    if (body.length > 2000) return new Response('Too large', { status: 413, headers: cors });

    const upstream = await fetch(UPSTREAM + action, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};
