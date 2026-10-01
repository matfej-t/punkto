# Punkto

**Free scoreboard & leaderboard for classrooms and quiz nights.**
Static site — HTML, CSS and vanilla JavaScript. No backend, no build step, no accounts.
All data stays in the visitor's browser.

- **Leaderboard mode:** many players or teams, optional photos, points, quick +/− buttons, rounds view (points per round).
- **Scoreboard mode:** two teams like football, logos, optional squads, goal scorers, optional match clock.
- **Control view** for the host (mobile-friendly, keyboard shortcuts, undo) and a **Display view** for the TV or projector. The display updates live (`BroadcastChannel`), stays fullscreen and keeps the screen awake.
- **End game** saves the result in a per-board history and shows a winner podium with a little confetti.
- **Autosave** in `localStorage`, **backup link** (board data in the URL `#fragment`), **JSON export/import**.
- **Customisation:** day/night mode (follows the system by default), 4 palettes plus custom colours, logos, photos, board titles. Images are resized and compressed in the browser (a photo is usually 5–25 KB).
- **12 languages:** English, German, Russian, Spanish, French, Italian, Portuguese, Polish, Ukrainian, Turkish, Czech, Dutch. The browser language is detected automatically, and each language has its own SEO page (`/de/`, `/fr/`, …).
- **Offline:** service worker; can be installed as an app (PWA).
- **Money:** two small AdSense slots, a free "hide ads for this session" option, and "Remove ads forever" through Lemon Squeezy license keys.

---

## Contents

1. [Try it locally](#1-try-it-locally)
2. [Deploy on GitHub Pages](#2-deploy-on-github-pages)
3. [Connect a custom domain](#3-connect-a-custom-domain)
4. [Add Google AdSense](#4-add-google-adsense)
5. [Set up Lemon Squeezy (Remove ads forever)](#5-set-up-lemon-squeezy-remove-ads-forever)
6. [config.js reference](#6-configjs-reference)
7. [Languages and SEO pages](#7-languages-and-seo-pages)
8. [Updating the site](#8-updating-the-site)
9. [Tests](#9-tests)
10. [Project structure](#10-project-structure)
11. [Privacy and GDPR notes](#11-privacy-and-gdpr-notes)

---

## 1. Try it locally

You need some kind of local web server, because ES modules and service workers don't run from `file://`.

```bash
cd punkto
python3 -m http.server 8080        # or: npx serve .
# open http://localhost:8080
```

To preview where the ads will appear, add `?adpreview=1` to the address, for example `http://localhost:8080/?adpreview=1`.

## 2. Deploy on GitHub Pages

1. Push this repository to GitHub. The site lives in the repository root.
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
4. Set **Branch** to `main` with folder `/ (root)`, then click **Save**. If your code is on a different branch, merge it into `main` first or select that branch here.
5. After about a minute the site is live at `https://<your-user>.github.io/<repo>/`. For this repository that is `https://matfej-t.github.io/punkto/`.

`config.js` → `siteUrl` is already set to that address. If your address is different, see [section 7](#7-languages-and-seo-pages).
The empty `.nojekyll` file tells GitHub to serve the files as they are, without running Jekyll.

## 3. Connect a custom domain

A custom domain such as `punkto.app` looks more professional. **You also need one for AdSense**, because AdSense doesn't accept a `github.io/<repo>` sub-path site.

1. Buy a domain from any registrar (Namecheap, Cloudflare, INWX, …).
2. Add DNS records at your registrar:
   - **Apex domain** (`punkto.app`): four `A` records pointing to
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
     IPv6 is optional: four `AAAA` records pointing to `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
   - **www** (`www.punkto.app`): a `CNAME` record pointing to `<your-user>.github.io`.
3. On GitHub, go to **Settings → Pages → Custom domain**, enter `punkto.app` and click **Save**. GitHub creates a `CNAME` file in the repository for you.
4. Once the DNS check passes, which can take up to a few hours, tick **Enforce HTTPS**.
5. Edit `config.js` and set `siteUrl: "https://punkto.app/"`, with the trailing slash.
6. Run `node tools/generate-pages.mjs` (see [section 7](#7-languages-and-seo-pages)), then commit and push.
7. Optional but recommended: in [Google Search Console](https://search.google.com/search-console), add the domain and submit `https://punkto.app/sitemap.xml`.

## 4. Add Google AdSense

The ad code is already wired in. You don't have to paste any HTML: you only fill in IDs in `config.js`.

**Where the ads go.** These rules are already implemented in `js/ads.js` and `css/app.css`:
- **Control view:** one responsive banner at the very bottom of the page, with a gap of at least 72 px below the last button.
- **Display view:** one small 320×50 unit in the bottom-right corner. The display view has no buttons except the overlay that appears on mouse movement in the top-right corner.
- **No ads** on the home page, in dialogs, or for Premium users. Visitors who click "Hide ads" get no ad code for the rest of the session.

**Steps:**

1. Connect a custom domain first (see [section 3](#3-connect-a-custom-domain)).
2. Sign up at <https://adsense.google.com>, add your site and copy your publisher ID (`ca-pub-1234567890123456`).
3. In `config.js`, set:
   ```js
   ads: { enabled: true, adsenseClient: "ca-pub-1234567890123456", slots: { control: "", display: "" } }
   ```
4. **Site verification:** run `node tools/generate-pages.mjs`. It adds `<meta name="google-adsense-account" …>` to every page. Then commit and push.
   If AdSense asks you to paste its `<script>` into `<head>` instead, paste it into `tools/page-template.html` (there is a comment marking the spot) and run the generator again.
5. **ads.txt:** create a file called `ads.txt` in the repository root containing the line AdSense shows you, for example:
   ```
   google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0
   ```
6. After your site is approved, go to **Ads → By ad unit** and create two **Display ads**:
   - "Punkto control": *Responsive*. Copy its `data-ad-slot` number into `slots.control`.
   - "Punkto display": *Fixed size 320 × 50*. Copy its `data-ad-slot` into `slots.display`.
7. **Turn Auto ads OFF** for the site (Ads → By site → edit). Auto ads would place ads next to buttons, which hurts the user experience and goes against AdSense's accidental-click policy.
8. **EU/UK consent:** in AdSense go to **Privacy & messaging → European regulations** and publish a consent message using Google's free certified CMP. It is loaded together with the ad script, so you don't need to change any code.

In the code, the AdSense loader is in `js/ads.js` → `loadScript()` and the `<ins class="adsbygoogle">` units are in `adSlot()`. Both are marked with comments.

## 5. Set up Lemon Squeezy (Remove ads forever)

1. Create a store at <https://lemonsqueezy.com> and complete the payout and identity steps.
2. **Products → New product**, for example "Punkto Premium — no ads":
   - Pricing: **Single payment**, for example €9.
   - Turn on **Generate license keys**. Set the **activation limit** to something like 5, so one buyer can use it in several browsers, and set **License length** to *never expires*.
   - Optional: under **Confirmation modal / Thank-you page**, link back to your site, for example `https://punkto.app/`.
3. **Payment methods:** cards, Apple Pay and Google Pay work automatically in supported browsers. Turn on **PayPal** under **Settings → Payments**.
4. Copy the product's **checkout link** (Share → Checkout URL) into `config.js` → `premium.checkoutUrl`, and set `premium.priceLabel` to match the price, for example `"€9"`.
5. **Recommended:** lock license keys to your product. You can find your **Store ID** under Settings → Stores and your **Product ID** in the product URL or through the API. Set `expectedStoreId` and `expectedProductId`. Without them, a valid key from *any* Lemon Squeezy product would unlock Premium.

**What the buyer sees:** they pay, receive a license key by e-mail, open **Ad-free → "Already bought? Enter your license key"** and click **Activate**.

**How the check works:** `js/premium.js` sends `POST https://api.lemonsqueezy.com/v1/licenses/activate` with a form-encoded body (`license_key`, `instance_name`).
Lemon Squeezy's License API doesn't need an API key: it is designed for client apps. The request is a CORS "simple request" (form body, `Accept` header only), so the browser sends no preflight. The response is checked (`activated`, store and product IDs) and the result is stored in `localStorage`.
Every 30 days the key is checked again with `/validate`. Only an explicit "disabled / expired" answer, for example after a refund, removes Premium. Being offline never does.

**If activation fails because of CORS.** I couldn't call the Lemon Squeezy API from the build environment to confirm that it sends CORS headers. So if a real key always shows *"Couldn't reach the license server"* while you are online, and the browser console shows a CORS error, use the included proxy. It is the simplest working alternative:

1. Create a free Cloudflare account, then go to **Workers & Pages → Create → Worker**.
2. Paste in `tools/license-proxy-worker.js`, set `ALLOWED_ORIGIN` to your site (for example `https://punkto.app`), and deploy.
3. Set `premium.licenseProxyUrl` in `config.js` to the worker URL, for example `"https://punkto-license.you.workers.dev"`.

The worker only forwards the three public license calls and adds CORS headers. It holds no secrets.

You can check the CORS behaviour yourself in about 10 seconds:

```bash
curl -si -X POST https://api.lemonsqueezy.com/v1/licenses/validate \
  -H "Origin: https://punkto.app" -H "Accept: application/json" \
  -d "license_key=test" | grep -i access-control
```

If an `access-control-allow-origin` line shows up, direct browser calls work and you don't need the worker.

> Like every purely client-side unlock, a technical user could fake Premium by editing `localStorage`. For "remove ads" that is an acceptable trade-off: honest users pay, and no server is needed.

## 6. config.js reference

| Setting | Meaning |
|---|---|
| `siteUrl` | Public address with trailing slash. Used for canonical/hreflang tags, the sitemap and the "made with Punkto" link. |
| `contactEmail` | Shown on the privacy page if set. |
| `languages` | UI languages. The first one is the fallback. |
| `ads.enabled` | Master switch for ads. |
| `ads.adsenseClient` | `ca-pub-…`. While it is empty, no ad code loads. |
| `ads.slots.control` / `ads.slots.display` | AdSense ad unit IDs. |
| `ads.showPlaceholders` | Show dashed placeholder boxes (or add `?adpreview=1` to the URL). |
| `premium.checkoutUrl` | Lemon Squeezy checkout link. |
| `premium.priceLabel` | Text on the buy button. |
| `premium.licenseProxyUrl` | Optional CORS proxy (see [section 5](#5-set-up-lemon-squeezy-remove-ads-forever)). |
| `premium.expectedStoreId` / `expectedProductId` | Reject keys for other products. |
| `premium.mode` | `"activate"`: counts against the activation limit (recommended). `"validate"`: only checks the key. |
| `premium.revalidateDays` | How often a stored key is checked again. |

## 7. Languages and SEO pages

- All UI text is in `i18n/<code>.json`. English (`en.json`) is the reference.
- Plural forms use the [CLDR categories](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html) (`one`, `few`, `many`, `other`), for example in `ru.json`.
- `tools/generate-pages.mjs` builds the static, SEO-friendly pages from `tools/page-template.html`:
  - `index.html` (English, `x-default`) and `de/index.html`, `fr/index.html`, … Each has a translated `<title>`, meta description, `lang` attribute, `hreflang` links, Open Graph tags, JSON-LD and a crawlable intro, features and FAQ text.
  - `sitemap.xml`, `robots.txt`, `404.html`.
  - The list of offline files in `sw.js`, plus a new cache version.

  ```bash
  node tools/generate-pages.mjs     # Node 18+, no npm install needed
  ```

  Run it after you change `siteUrl`, `languages`, the AdSense ID or translation texts. The generated files are committed, so the site itself still has **no build step**.

**To add a language,** for example Swedish:

1. Copy `i18n/en.json` to `i18n/sv.json` and translate the values. Keep the keys and the `{placeholders}` unchanged.
2. Add `"sv"` to `languages` in `config.js`, and add `sv: 'Svenska'` to `LANG_NAMES` in `js/i18n.js`.
3. Run `node tools/generate-pages.mjs`, then commit and push.

The language switcher updates the address (`/de/`, `/fr/` …) and remembers the choice. On the root page, the browser language is used for visitors who haven't chosen one yet.

## 8. Updating the site

Edit the files, run `node tools/generate-pages.mjs` (this refreshes the offline cache version), then commit and push.
The service worker serves the cached app immediately and fetches updates in the background, so returning visitors get the new version on their next visit.

## 9. Tests

`tests/e2e.mjs` drives a real Chromium browser through every feature: creating boards, adding players by typing and pasting, photo compression, scoring with buttons, keys and undo, live display sync, rounds, end game, podium and history, scoreboard scorers and clock, backup link restore, JSON export/import, invalid and valid license keys (with a mocked Lemon Squeezy API), session ad hiding, all 12 language pages, browser language detection, day/night mode, mobile layout and offline mode.

```bash
npm i -D playwright && npx playwright install chromium   # once
node tests/e2e.mjs
```

## 10. Project structure

```
index.html, de/ … nl/     generated language pages (edit tools/page-template.html instead)
config.js                 ← all settings (ads, premium, site URL, languages)
css/app.css               all styles: palettes, day/night, control & display layouts
js/app.js                 bootstrap + hash router
js/store.js               localStorage persistence + BroadcastChannel live sync
js/model.js               board data model and game logic (pure functions)
js/i18n.js                translations, plurals, language detection
js/theme.js               day/night mode, palettes
js/images.js              client-side image resize/compression
js/share.js               backup links, JSON export/import
js/premium.js             Lemon Squeezy license activation
js/ads.js                 AdSense slots
js/confetti.js            tiny confetti effect
js/views/                 home, control (leaderboard/scoreboard), display, winner, shared dialogs
i18n/*.json               UI text, one file per language
sw.js                     service worker (offline)
tools/                    page generator, icon renderer, optional license proxy worker
tests/e2e.mjs             browser tests
```

**Keyboard shortcuts** (Control view; press `?` in the app to see them):
- **Leaderboard:** `↑/↓` or `1–9` select a player, `+`/`→` add points, `−`/`←` subtract, `Shift+→/←` use the second point button, `N` starts the next round, `R` toggles the rounds view, `E` edit mode.
- **Scoreboard:** `Q`/`A` add or remove a goal for the first team, `P`/`L` for the second team, `1–9` pick the scorer, `Space` starts or pauses the clock.
- **Everywhere:** `D` opens the display, `Z`/`Ctrl+Z` undo. On the display, `F` toggles fullscreen.

## 11. Privacy and GDPR notes

- Punkto stores boards, names, scores and photos **only in `localStorage`** on the visitor's device. There is no server, database or analytics.
- Backup links keep the data after `#`, which browsers never send to a server.
- The app uses no external fonts or CDNs, so the only third parties are:
  - GitHub Pages (hosting),
  - Google AdSense (free version only, after consent where required),
  - Lemon Squeezy (only when a license key is activated).

  The privacy page (`#/privacy`) explains this in all 12 languages. Add your contact e-mail in `config.js` and have the text checked against your own legal situation. Depending on your country, you may also need an imprint (Impressum).
- For schools: Premium users load no third-party ad code at all.
