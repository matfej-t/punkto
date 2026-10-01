#!/usr/bin/env node
// End-to-end test of every Punkto feature in a real browser (Chromium).
//
//   npm i -D playwright && npx playwright install chromium   (once)
//   node tests/e2e.mjs
//
// Starts its own tiny static server, so nothing else is needed.
// The Lemon Squeezy License API is mocked — no real network calls.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(ROOT, p);
  try {
    if ((await stat(file)).isDirectory()) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;

let passed = 0, failed = 0, page;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) {
    failed++;
    console.log('  ✗', name, '\n     ', e.message.split('\n')[0]);
    const shot = join(tmpdir(), `punkto-fail-${failed}.png`);
    await page?.screenshot({ path: shot }).then(() => console.log('      screenshot:', shot)).catch(() => {});
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const browser = await chromium.launch();
const errors = [];
async function newCtx(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'], ...opts });
  ctx.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  return ctx;
}
const boardOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('punkto:board:' + location.hash.split('/')[2])));

console.log('Punkto e2e');

/* ------------------------------------------------------------- leaderboard */
const ctx = await newCtx();
page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message));
let display;

await test('home shows privacy promise and SEO content', async () => {
  await page.goto(BASE + '?adpreview=1');
  await page.waitForSelector('.privacy-note');
  assert(await page.locator('.faq details').count() === 5, 'faq');
  assert((await page.title()).includes('Punkto'));
});

await test('create a leaderboard with the mode cards', async () => {
  await page.click('text=Create your first board');
  assert(await page.locator('.mode-card svg').count() === 2, 'two illustrated cards');
  await page.fill('dialog input.input', 'Class 4B');
  await page.click('text=Create board');
  await page.waitForSelector('[data-key="add"]');
});

await test('add players by Enter and by pasting a list', async () => {
  for (const n of ['Anna', 'Ben']) { await page.fill('[data-key="add"]', n); await page.keyboard.press('Enter'); }
  await page.focus('[data-key="add"]');
  await page.evaluate(() => {
    const dt = new DataTransfer(); dt.setData('text/plain', 'Carla\nDavid\nEmma');
    document.querySelector('[data-key="add"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  eq((await boardOf(page)).players.map(p => p.name), ['Anna', 'Ben', 'Carla', 'David', 'Emma']);
  await page.click('button:has-text("Done")');
});

await test('photo upload is resized and compressed', async () => {
  await page.click('button:has-text("Edit players")');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.avatar-btn').first().click()]);
  await fc.setFiles(join(ROOT, 'icons/og.png'));
  await page.waitForSelector('.lb-row img.avatar');
  const photo = (await boardOf(page)).players[0].photo;
  assert(photo.startsWith('data:image/'), 'data url');
  assert(photo.length < 40000, 'compressed: ' + photo.length);
  await page.click('button:has-text("Done")');
});

await test('score with buttons, keyboard and undo', async () => {
  await page.locator('.lb-row').nth(1).locator('.step.plus.primary').click();
  await page.locator('.lb-row').nth(1).locator('.step.plus').nth(1).click(); // +5
  await page.keyboard.press('3');
  await page.keyboard.press('+'); await page.keyboard.press('+');
  await page.keyboard.press('ArrowLeft');
  eq((await page.locator('.score').allTextContents()).slice(0, 3), ['0', '6', '1']);
  await page.keyboard.press('Control+z');
  eq((await page.locator('.score').allTextContents())[2], '2', 'undo');
});

await test('display window updates live (BroadcastChannel)', async () => {
  [display] = await Promise.all([ctx.waitForEvent('page'), page.click('.display-btn')]);
  await display.setViewportSize({ width: 1920, height: 1080 });
  await display.waitForSelector('.d-row');
  eq(await display.locator('.d-name').first().textContent(), 'Ben');
  await page.bringToFront();
  for (let i = 0; i < 8; i++) await page.locator('.lb-row').nth(4).locator('.step.plus.primary').click();
  await display.waitForTimeout(300);
  eq(await display.locator('.d-name').first().textContent(), 'Emma', 'new leader');
  assert(await display.locator('.made-with').count() === 1, 'badge');
  assert(await display.locator('.ad-display').count() === 1, 'display ad slot');
});

await test('rounds: new round, edit a cell, display shows the table', async () => {
  await page.keyboard.press('n');
  await page.keyboard.press('r');
  await page.waitForSelector('.rounds-table');
  const cell = page.locator('[data-key$="-1"]').first();
  await cell.fill('7'); await cell.press('Enter');
  const b = await boardOf(page);
  eq(b.roundCount, 2); eq(b.players[0].scores[1], 7);
  await display.waitForSelector('.d-rounds');
  await page.click('.segmented button:has-text("Points")');
});

await test('control ad sits at the very bottom, far from buttons', async () => {
  const ad = await page.locator('.ad-zone .ad-slot').boundingBox();
  const end = await page.locator('.btn-end').boundingBox();
  assert(ad && end && ad.y - (end.y + end.height) > 60, 'gap below End game');
});

await test('end game → winner podium, display overlay, history', async () => {
  await page.click('.btn-end');
  await page.click('dialog .btn-primary');
  await page.waitForSelector('.podium');
  eq(await page.locator('.winner-title').textContent(), 'Emma wins!');
  await display.waitForSelector('.d-overlay.on .podium');
  await page.click('text=New game');
  await page.waitForSelector('.lb-row');
  await display.waitForTimeout(300);
  assert(await display.locator('.d-overlay.on').count() === 0, 'overlay closed');
  const b = await boardOf(page);
  eq(b.history.length, 1); assert(b.players.every(p => !p.scores.length), 'scores reset');
});

/* -------------------------------------------------------------- scoreboard */
await test('scoreboard: scorer picker, minus, clock, display', async () => {
  await page.goto(BASE + '?adpreview=1#/');
  await page.click('.section-head button:has-text("New board")');
  await page.click('.mode-card[data-mode="scoreboard"]');
  await page.fill('dialog input.input', 'Cup final');
  await page.click('text=Create board');
  await page.waitForSelector('.team-card');
  await page.click('button:has-text("Edit teams")');
  await page.fill('[data-key="sq-add-0"]', 'Sam'); await page.keyboard.press('Enter');
  await page.fill('[data-key="sq-add-0"]', 'Kim'); await page.keyboard.press('Enter');
  await page.click('button:has-text("Done")');
  await page.keyboard.press('q');
  await page.waitForSelector('.scorer-modal');
  await page.keyboard.press('2');
  await page.keyboard.press('p');
  await page.keyboard.press('p');
  await page.keyboard.press('l');
  eq(await page.locator('.team-score').allTextContents(), ['1', '1']);
  const b = await boardOf(page);
  eq(b.events[0].playerId, b.teams[0].players[1].id, 'scorer Kim');
  // clock
  await page.click('.ctl-bar .icon-btn[aria-label="More"]');
  await page.click('.menu-item:has-text("Board settings")');
  await page.check('dialog input[type=checkbox]');
  await page.click('dialog .modal-foot .btn-primary');
  await page.keyboard.press(' ');
  await page.waitForTimeout(1200);
  await page.keyboard.press(' ');
  assert((await boardOf(page)).clock.elapsed >= 1000, 'clock ran');
  const [d2] = await Promise.all([ctx.waitForEvent('page'), page.keyboard.press('d')]);
  await d2.waitForSelector('.d-sb');
  eq(await d2.locator('.d-big').allTextContents(), ['1', '1']);
  assert((await d2.locator('.d-scorers').first().textContent()).includes('Kim'));
  await d2.close();
});

/* ---------------------------------------------------------- backup/restore */
let link;
await test('copy backup link and restore it in another browser', async () => {
  await page.click('.ctl-bar .icon-btn[aria-label="More"]');
  await page.click('.menu-item:has-text("Copy backup link")');
  await page.waitForTimeout(200);
  link = await page.evaluate(() => navigator.clipboard.readText());
  assert(link.includes('#/import/'), link);
  const ctx2 = await newCtx();
  const p2 = await ctx2.newPage();
  await p2.goto(link);
  await p2.click('dialog .btn-primary');
  await p2.waitForSelector('.team-card');
  eq(await p2.locator('.ctl-title').textContent(), 'Cup final');
  await ctx2.close();
});

await test('export all boards to JSON and import into an empty browser', async () => {
  await page.goto(BASE + '#/');
  await page.click('.appbar .icon-btn[aria-label="Settings"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('dialog button:has-text("Export all boards")')]);
  const file = await dl.path();
  const ctx3 = await newCtx();
  const p3 = await ctx3.newPage();
  await p3.goto(BASE);
  await p3.waitForSelector('.empty');
  const [fc] = await Promise.all([p3.waitForEvent('filechooser'), p3.click('.section-head button:has-text("Import")')]);
  await fc.setFiles(file);
  await p3.waitForSelector('.board-card');
  eq(await p3.locator('.board-card').count(), 2);
  await ctx3.close();
});

/* ------------------------------------------------------------------ premium */
await test('premium: invalid key shows an error', async () => {
  await page.route('https://api.lemonsqueezy.com/v1/licenses/activate', r => r.fulfill({
    status: 400, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ activated: false, error: 'license_key not found.' })
  }));
  await page.goto(BASE + '?adpreview=1#/');
  await page.click('.site-footer button:has-text("Ad-free")');
  await page.fill('.premium-modal input', 'BAD-KEY-1234567');
  await page.click('.premium-modal button:has-text("Activate")');
  await page.waitForSelector('.premium-modal .error-text');
  assert((await page.locator('.premium-modal .error-text').textContent()).includes('not valid'));
  await page.unroute('https://api.lemonsqueezy.com/v1/licenses/activate');
});

await test('premium: valid key removes ads and badge', async () => {
  let sent = '';
  await page.route('https://api.lemonsqueezy.com/v1/licenses/activate', r => {
    sent = r.request().postData();
    r.fulfill({
      status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ activated: true, error: null, license_key: { status: 'active' }, instance: { id: 'inst-1' }, meta: { store_id: 1, product_id: 2, product_name: 'Punkto Premium' } })
    });
  });
  await page.fill('.premium-modal input', '38b1460a-5104-4067-a91d-77b872934d51');
  await page.click('.premium-modal button:has-text("Activate")');
  await page.waitForTimeout(400);
  assert(sent.includes('license_key=38b1460a') && sent.includes('instance_name='), 'form body: ' + sent);
  const lic = await page.evaluate(() => JSON.parse(localStorage.getItem('punkto:license')));
  eq(lic.instanceId, 'inst-1');
  await page.click('.board-card .board-card-main >> nth=0');
  await page.waitForSelector('.ctl-main');
  eq(await page.locator('.ad-slot').count(), 0, 'no control ad');
  const [d3] = await Promise.all([ctx.waitForEvent('page'), page.keyboard.press('d')]);
  await d3.waitForSelector('.d-foot');
  eq(await d3.locator('.made-with, .ad-slot').count(), 0, 'no badge/ad on display');
  await d3.close();
  await page.evaluate(() => localStorage.removeItem('punkto:license'));
});

await test('free "hide ads" works for the session', async () => {
  const ctx4 = await newCtx();
  const p4 = await ctx4.newPage();
  await p4.goto(BASE + '?adpreview=1#/');
  await p4.click('text=Try an example');
  await p4.click('.board-card .board-card-main >> nth=0');
  await p4.waitForSelector('.ad-slot');
  await p4.click('.adfree-chip');
  await p4.click('.premium-modal button:has-text("Hide ads")');
  await p4.waitForTimeout(200);
  eq(await p4.locator('.ad-slot').count(), 0);
  await ctx4.close();
});

/* ---------------------------------------------------------------- languages */
await test('all language pages: lang attribute, translated title and UI', async () => {
  const cfgText = await readFile(join(ROOT, 'config.js'), 'utf8');
  const langs = JSON.parse(cfgText.match(/languages:\s*(\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const ctx5 = await newCtx();
  const p5 = await ctx5.newPage();
  for (const l of langs) {
    const dict = JSON.parse(await readFile(join(ROOT, `i18n/${l}.json`), 'utf8'));
    await p5.goto(BASE + (l === 'en' ? '' : l + '/'));
    await p5.waitForSelector('.hero h1');
    eq(await p5.evaluate(() => document.documentElement.lang), l, 'lang attr');
    eq(await p5.title(), dict.meta.title, `${l} title`);
    eq(await p5.locator('.hero h1').textContent(), dict.home.h1, `${l} h1`);
    eq(await p5.locator('link[rel=alternate][hreflang]').count(), langs.length + 1, 'hreflang');
  }
  await ctx5.close();
});

await test('browser language is detected on the root page', async () => {
  const ctx6 = await newCtx({ locale: 'pl-PL' });
  const p6 = await ctx6.newPage();
  await p6.goto(BASE);
  await p6.waitForSelector('.hero h1');
  eq(await p6.evaluate(() => document.documentElement.lang), 'pl');
  await ctx6.close();
});

/* ------------------------------------------------------- theme / mobile / sw */
await test('day/night toggle persists', async () => {
  await page.goto(BASE + '#/');
  const before = await page.evaluate(() => document.documentElement.dataset.scheme);
  await page.click('.appbar .icon-btn[aria-label="Day / night mode"]');
  await page.reload();
  await page.waitForSelector('.hero');
  assert(await page.evaluate(() => document.documentElement.dataset.scheme) !== before);
});

await test('mobile: no horizontal scrolling on home and control', async () => {
  const ctx7 = await newCtx({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const p7 = await ctx7.newPage();
  await p7.goto(BASE + '?adpreview=1');
  await p7.click('text=Try an example');
  for (const n of [0, 1]) {
    await p7.goto(BASE + '?adpreview=1#/');
    await p7.click(`.board-card .board-card-main >> nth=${n}`);
    await p7.waitForSelector('.ctl-main');
    assert(await p7.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'overflow on board ' + n);
  }
  await ctx7.close();
});

await test('works offline after the first visit (service worker)', async () => {
  const ctx8 = await newCtx();
  const p8 = await ctx8.newPage();
  await p8.goto(BASE);
  await p8.evaluate(() => navigator.serviceWorker.ready);
  await p8.reload();
  await p8.waitForTimeout(500);
  await ctx8.setOffline(true);
  await p8.reload();
  await p8.waitForSelector('.hero h1', { timeout: 5000 });
  await p8.goto(BASE + 'de/');
  await p8.waitForSelector('.hero h1', { timeout: 5000 });
  await ctx8.close();
});

await test('no uncaught JavaScript errors', async () => { eq(errors, []); });

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
