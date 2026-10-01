#!/usr/bin/env node
// Regenerates the static, SEO-friendly language pages and offline cache list.
//
//   node tools/generate-pages.mjs
//
// Writes:
//   index.html            English page (x-default)
//   <lang>/index.html     one page per language in config.js (translated
//                         <title>, meta description, hreflang, intro text)
//   sitemap.xml, robots.txt
//   sw.js                 refreshes the precache list + version hash
//
// Run it after changing config.js (siteUrl, languages, AdSense ID) or the
// translation files. It needs Node.js 18+ and nothing else. The site itself
// has no build step — the generated files are committed to the repository.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// Load config.js in a sandbox (it assigns window.PUNKTO_CONFIG).
const sandbox = { window: {} };
vm.runInNewContext(read('config.js'), sandbox);
const cfg = sandbox.window.PUNKTO_CONFIG;
const site = cfg.siteUrl.replace(/\/?$/, '/');
const langs = cfg.languages;
const FALLBACK = langs[0];

const OG_LOCALE = { en: 'en_US', de: 'de_DE', ru: 'ru_RU', es: 'es_ES', fr: 'fr_FR', it: 'it_IT', pt: 'pt_PT', pl: 'pl_PL', uk: 'uk_UA', tr: 'tr_TR', cs: 'cs_CZ', nl: 'nl_NL' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pageUrl = (l) => site + (l === FALLBACK ? '' : `${l}/`);

const en = JSON.parse(read(`i18n/${FALLBACK}.json`));
const lookup = (d, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), d);

const template = read('tools/page-template.html');
const hreflang = [
  ...langs.map(l => `<link rel="alternate" hreflang="${l}" href="${pageUrl(l)}">`),
  `<link rel="alternate" hreflang="x-default" href="${pageUrl(FALLBACK)}">`
].join('\n');

for (const lang of langs) {
  const file = `i18n/${lang}.json`;
  if (!existsSync(join(ROOT, file))) { console.warn(`! missing ${file}, skipped`); continue; }
  const dict = JSON.parse(read(file));
  const t = (k) => lookup(dict, k) ?? lookup(en, k) ?? k;
  const root = lang === FALLBACK ? './' : '../';

  const features = `<h2>${esc(t('home.featuresTitle'))}</h2>\n    <ul>\n` +
    [1, 2, 3, 4].map(i => `      <li><strong>${esc(t(`home.f${i}Title`))}</strong> — ${esc(t(`home.f${i}Text`))}</li>`).join('\n') + '\n    </ul>';
  const faq = `<h2>${esc(t('faq.title'))}</h2>\n` +
    [1, 2, 3, 4, 5].map(i => `    <h3>${esc(t(`faq.q${i}`))}</h3>\n    <p>${esc(t(`faq.a${i}`))}</p>`).join('\n');

  const jsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Punkto',
    url: pageUrl(lang),
    inLanguage: lang,
    description: t('meta.description'),
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any (web browser)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
  }).replace(/</g, '\\u003c');

  const vars = {
    lang, root,
    title: esc(t('meta.title')),
    description: esc(t('meta.description')),
    canonical: `<link rel="canonical" href="${pageUrl(lang)}">`,
    hreflang,
    ogLocale: OG_LOCALE[lang] || lang,
    ogExtra: `<meta property="og:url" content="${pageUrl(lang)}">\n<meta property="og:image" content="${site}icons/og.png">`,
    adsenseMeta: cfg.ads?.adsenseClient ? `<meta name="google-adsense-account" content="${esc(cfg.ads.adsenseClient)}">` : '',
    jsonld,
    h1: esc(t('home.h1')),
    tagline: esc(t('home.tagline')),
    privacyTitle: esc(t('home.privacyTitle')),
    privacyText: esc(t('home.privacyText')),
    features, faq
  };
  const html = template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  const out = lang === FALLBACK ? 'index.html' : `${lang}/index.html`;
  mkdirSync(dirname(join(ROOT, out)), { recursive: true });
  writeFileSync(join(ROOT, out), html);
  console.log('✓', out);
}

/* -------------------------------------------------------- sitemap/robots */
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${langs.map(l => `  <url>
    <loc>${pageUrl(l)}</loc>
    <lastmod>${today}</lastmod>
${langs.map(a => `    <xhtml:link rel="alternate" hreflang="${a}" href="${pageUrl(a)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(FALLBACK)}"/>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap);
writeFileSync(join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site}sitemap.xml\n`);
// GitHub Pages serves 404.html for unknown paths: send visitors to the app.
writeFileSync(join(ROOT, '404.html'), `<!doctype html>
<!-- GENERATED by tools/generate-pages.mjs -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Punkto</title><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${site}">
<style>body{font:18px system-ui,sans-serif;background:#FFF7EE;color:#2B1D14;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#E8572A}</style>
</head><body><p>Page not found — <a href="${site}">open Punkto</a></p></body></html>
`);
console.log('✓ sitemap.xml, robots.txt, 404.html');

/* ------------------------------------------------- service worker assets */
const walk = (dir) => readdirSync(join(ROOT, dir)).flatMap(f => {
  const p = join(dir, f);
  return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p];
});
const assets = [
  './',
  ...langs.filter(l => l !== FALLBACK && existsSync(join(ROOT, l, 'index.html'))).map(l => `${l}/`),
  'config.js',
  'manifest.webmanifest',
  ...walk('css'), ...walk('js'), ...walk('i18n').filter(f => f.endsWith('.json')),
  'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png'
].map(p => p.split('\\').join('/'));

const hash = createHash('sha1');
for (const a of assets) {
  const file = a === './' ? 'index.html' : a.endsWith('/') ? `${a}index.html` : a;
  if (existsSync(join(ROOT, file))) hash.update(readFileSync(join(ROOT, file)));
}
const version = 'punkto-' + hash.digest('hex').slice(0, 10);
const sw = read('sw.js').replace(/\/\/ @@GENERATED-START[\s\S]*?\/\/ @@GENERATED-END/,
  `// @@GENERATED-START\nconst VERSION = '${version}';\nconst ASSETS = [\n${assets.map(a => `  '${a}'`).join(',\n')}\n];\n// @@GENERATED-END`);
writeFileSync(join(ROOT, 'sw.js'), sw);
console.log(`✓ sw.js (${assets.length} assets, ${version})`);
console.log(relative(process.cwd(), ROOT) || '.', 'done.');
