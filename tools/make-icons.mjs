#!/usr/bin/env node
// Renders the PNG icons and the social preview image from icons/icon.svg.
// Dev-only helper (needs Playwright): node tools/make-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(ROOT, 'icons/icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

async function shot(file, w, h, html) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
  await page.screenshot({ path: join(ROOT, 'icons', file), omitBackground: true });
  console.log('✓', file);
}
const icon = (size) => `<div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`;
await shot('icon-192.png', 192, 192, icon(192));
await shot('icon-512.png', 512, 512, icon(512));
await shot('apple-touch-icon.png', 180, 180, `<div style="width:180px;height:180px;background:#E8572A">${svg.replace('rx="120"', 'rx="0"').replace('<svg ', '<svg width="180" height="180" ')}</div>`);
// Maskable: full-bleed background, logo inside the 80% safe zone.
await shot('icon-maskable-512.png', 512, 512, `<div style="width:512px;height:512px;background:#E8572A;display:grid;place-items:center">${svg.replace('<svg ', '<svg width="400" height="400" ')}</div>`);
// Social preview (Open Graph) 1200×630.
await shot('og.png', 1200, 630, `
<div style="width:1200px;height:630px;background:#FFF7EE;display:flex;align-items:center;gap:56px;padding:0 90px;box-sizing:border-box;font-family:system-ui,sans-serif;color:#2B1D14">
  ${svg.replace('<svg ', '<svg width="260" height="260" ')}
  <div>
    <div style="font-size:96px;font-weight:900;letter-spacing:-2px">Punkto</div>
    <div style="font-size:40px;font-weight:700;color:#7A6556;margin-top:8px;line-height:1.25">Free online scoreboard<br>&amp; leaderboard</div>
    <div style="margin-top:28px;display:flex;gap:14px;font-size:26px;font-weight:700">
      <span style="background:#E8572A;color:#fff;padding:8px 20px;border-radius:99px">No sign-up</span>
      <span style="background:#2E9C8A;color:#fff;padding:8px 20px;border-radius:99px">Works offline</span>
      <span style="background:#F5C542;color:#4a3300;padding:8px 20px;border-radius:99px">TV ready</span>
    </div>
  </div>
</div>`);
await browser.close();
