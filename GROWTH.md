# Growing Punkto: getting visitors

The app is done. Revenue now depends only on visitors, so this is the plan. Do it in order: each step makes the next one work better.

**Realistic expectations:** a new website usually needs 3–6 months before Google sends steady traffic. The first month is mostly Google discovering the pages. Judge results by the trend in Search Console, not by single days.

---

## Week 1: foundations (once, about 2 hours)

1. **Domain.** Get one, for example via the GitHub Student Developer Pack, and connect it (README §3).
   Then set `siteUrl` in `config.js`, run `node tools/generate-pages.mjs`, then commit and push.
   > Every page tells Google its own address. Until `siteUrl` matches the real domain, Google is pointed at the old one.
2. **Google Search Console** (search.google.com/search-console):
   - Add a *Domain* property and verify it with the DNS TXT record your registrar lets you add.
   - Go to **Sitemaps** and submit `https://YOUR-DOMAIN/sitemap.xml`. It lists all 72 pages (12 languages × app + 5 landing pages).
   - Use **URL inspection** to request indexing for `/`, `/de/`, `/scoreboard/`, `/quiz/` and `/classroom/`.
3. **Bing Webmaster Tools** (bing.com/webmasters): import the site from Search Console with one click. Bing also powers DuckDuckGo, Ecosia and several AI search tools.
4. **Statistics:** create a free GoatCounter account and put the URL in `config.js` (README §12).
5. **AdSense:** apply once the domain is live and the pages are indexed. Set it up as in README §4, with Auto ads OFF.
6. **Lemon Squeezy:** create the product and paste the checkout link (README §5).

## Weeks 1–2: listings (backlinks that also bring visitors)

Submit Punkto to each of these. Use the texts further down. Each one is a link Google trusts.

| Where | What to do |
|---|---|
| **AlternativeTo.net** | Add Punkto as an alternative to other online scoreboard and leaderboard sites ("Keep the Score", "Scoreboard", "Flippity", "Classroomscreen"). People search this site directly. |
| **Product Hunt** | Launch on a Tuesday–Thursday. Upload 4 screenshots: home, leaderboard control, TV display, podium. |
| **Show HN** (news.ycombinator.com) | Post the "Show HN" text. Stay around to answer comments for the first 2 hours. |
| **SaaSHub, Uneed, Indie Hackers** | Free listings for indie tools. |
| **Your own GitHub repo** | Add the site URL and topics (`scoreboard`, `leaderboard`, `pwa`, `offline-first`) to the repo's About box. |

## Ongoing: communities (where users actually are)

Rules that keep you from getting banned:
- **Post as the maker, say it's free, and ask for feedback.** Don't advertise.
- **Read each group's rules first.** Many only allow self-promotion in a weekly thread.
- **One post per community.** After that, answer questions in threads where a scoreboard is genuinely the answer.

Where to post:
- **Teachers:** r/edtech and r/teachingresources; Facebook groups for teachers in Germany, Poland, Czechia, the Netherlands and Turkey (search "Lehrer Ideen", "nauczyciele", "učitelé", "leerkrachten", "öğretmenler"). Non-English groups are less crowded, and Punkto speaks their language.
- **Quiz hosts:** r/pubquiz, r/trivia, quiz-host Facebook groups.
- **Game nights:** r/boardgames (in their self-promotion thread only), r/cardgames.
- **Makers:** r/SideProject, and r/webdev on "Showoff Saturday".

## Monthly routine (30 minutes)

1. In **Search Console → Performance**, sort queries by *impressions*:
   - **A page gets impressions but few clicks:** improve its `title` and `description` in `content/landing/<lang>.json`, then regenerate.
   - **A query has no page yet** (for example "darts scoreboard" or "basketball scoreboard online"): add a landing page. Copy an entry in `content/landing/*.json` and add the slug to `LANDING` in `tools/generate-pages.mjs` and `USE_CASES` in `js/views/common.js`.
2. In **GoatCounter**, compare `board-created-*` with page views. If few visitors create a board, the landing pages aren't convincing: change the intro and button text.
3. Track `premium-checkout-clicked` against actual sales. Many clicks with few sales means the price is too high; try €5.

**Decision point after 3 months:**
- Search Console clicks are rising: keep adding pages for the queries you see.
- Clicks are flat: the competition for these phrases is too strong. Focus on the non-English pages and the communities.

## Don't

- Don't buy links or traffic, or use "SEO packages". Google penalises this, and the site may never recover.
- Don't post the same text in many groups the same day. It gets flagged as spam.
- Don't write fake reviews.

---

## Ready-to-paste texts

**One-liner (≤ 60 characters)**
> Free online scoreboard & leaderboard for TV and projector

**Short description (≤ 260 characters)**
> Punkto is a free scoreboard and leaderboard you run in the browser. Keep score on your laptop and show it big on a TV or projector: rankings, rounds, two-team scoreboards and a winner podium. No sign-up, works offline, and your data never leaves your device.

**Long description (directories, Product Hunt)**
> I built Punkto because every scoreboard site I tried wanted an account, was slow, or looked like it was from 2008.
>
> Punkto runs entirely in your browser:
> • Leaderboards for any number of players or teams, always sorted by points, with rounds
> • Two-team scoreboard with goal scorers and a match clock
> • A huge display view for the TV or projector that updates instantly
> • "End game" shows a podium with confetti and keeps the result in a history
> • 12 languages, works offline, installable as an app
> • No accounts and no server: names and scores stay on your device (GDPR-friendly for schools)
>
> It's free with small ads, or ad-free with a one-time purchase. I'd love feedback!

**Show HN**
> Show HN: Punkto – a free, offline-first scoreboard for TVs and projectors
>
> Punkto is a static site (vanilla JS, no build step, no backend) for keeping score in classrooms, quiz nights and game nights. The control window and the fullscreen display window sync through BroadcastChannel. Everything is stored in localStorage, and a backup link encodes a board in the URL fragment, so no data ever reaches a server. It's in 12 languages and works offline through a service worker.
>
> I'd especially like feedback on the display view and on what's missing for your use case.

**Reddit (teacher/quiz communities), adapt the first line to the group**
> Title: I made a free class points board for the projector – no sign-up, data stays on your computer
>
> Hi! I built a small free tool for giving points to groups/teams and showing a live ranking on the projector (with a podium at the end of the week). No accounts, nothing uploaded, works offline, and it's in [your language]. Would love to hear what you'd need for it to be useful in your classroom: [link to the classroom landing page in that language]

Always link the **landing page in the reader's language**. For example, link a German group to `/de/classroom/`, not to the English home page.
