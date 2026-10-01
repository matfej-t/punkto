#!/usr/bin/env node
// One-command setup for going live on your own domain.
//
//   node tools/setup.mjs --domain punkto.me \
//        [--cloudflare <web-analytics-token>] \
//        [--google <search-console-code>] [--bing <bing-code>]
//
// What it does:
//   • config.js: siteUrl → https://<domain>/, plus the tokens you pass
//   • CNAME: tells GitHub Pages to serve the site on <domain>
//   • runs tools/generate-pages.mjs so every page, the sitemap and
//     robots.txt use the new address
// Any option can be run again later on its own, e.g. only --google.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).join(' ').split(/\s*--/).filter(Boolean)
  .map(p => { const [k, ...v] = p.trim().split(/\s+/); return [k, v.join(' ')]; }));

if (!Object.keys(args).length) {
  console.log('Usage: node tools/setup.mjs --domain example.com [--cloudflare TOKEN] [--google CODE] [--bing CODE]');
  process.exit(1);
}

const cfgPath = join(ROOT, 'config.js');
let cfg = readFileSync(cfgPath, 'utf8');
const setField = (re, value, label) => {
  if (!re.test(cfg)) throw new Error(`Could not find ${label} in config.js`);
  cfg = cfg.replace(re, (m, before) => `${before}${JSON.stringify(value)}`);
  console.log(`✓ ${label} = ${value}`);
};

if (args.domain) {
  const domain = args.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) throw new Error(`"${args.domain}" doesn't look like a domain`);
  setField(/(siteUrl:\s*)"[^"]*"/, `https://${domain}/`, 'siteUrl');
  writeFileSync(join(ROOT, 'CNAME'), domain + '\n');
  console.log(`✓ CNAME = ${domain}`);
}
if (args.cloudflare) {
  if (!/^[a-f0-9]{32}$/i.test(args.cloudflare)) throw new Error('The Cloudflare token should be 32 letters/digits');
  setField(/(cloudflareToken:\s*)"[^"]*"/, args.cloudflare, 'analytics.cloudflareToken');
}
if (args.google) {
  const code = args.google.replace(/^.*content="([^"]+)".*$/, '$1'); // accepts the whole <meta> tag too
  setField(/(verification:\s*\{[\s\S]*?google:\s*)"[^"]*"/, code, 'verification.google');
}
if (args.bing) {
  const code = args.bing.replace(/^.*content="([^"]+)".*$/, '$1');
  setField(/(verification:\s*\{[\s\S]*?bing:\s*)"[^"]*"/, code, 'verification.bing');
}

writeFileSync(cfgPath, cfg);
execFileSync(process.execPath, [join(ROOT, 'tools/generate-pages.mjs')], { stdio: 'inherit' });
console.log('\nDone. Commit and push to publish.');
