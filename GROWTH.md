# Your checklist: getting Punkto live and found

Everything that can be done in code is done. What's left needs **accounts in your name**: a domain you own, Google proving the site is yours, and money going to you. I can't create accounts or post as you. Each step below is just clicks, and I've written exactly which ones.

**How we work:** you do a step and send me what it says to send. I put it into the site and publish.

---

## Part A: go live (about 30 minutes, once)

### A1. Get the domain (10 min)
1. Open **education.github.com/pack** and sign in with GitHub.
2. Find a domain offer (for example *Namecheap* or *name.com*) and register a short name, ideally `punkto` plus whatever ending is free (`.me`, `.app`, `.live`, …).
3. **Send me the domain name.**

I then connect it in the code. After that you add these 5 records at your registrar. Look for **"DNS"** or **"Advanced DNS"** next to the domain and use **"Add record"** for each:

| Type | Host / Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `matfej-t.github.io` |

Delete any other A record for `@` the registrar created by default ("parking page"). It can take up to a few hours before the domain works.
Then, on GitHub: repository **Settings → Pages**. The domain should be filled in already. Once its check is green, tick **Enforce HTTPS**.

### A2. Statistics: see how many people visit (5 min)
1. Create a free account at **dash.cloudflare.com/sign-up**.
2. In the left menu: **Analytics & Logs → Web Analytics → Add a site**.
3. Enter your domain and click **Done**. Choose the *JavaScript snippet* option if asked.
4. In the code snippet it shows, copy the long code after `"token": "` (32 letters and numbers). **Send it to me.**

Cookie-free, free of charge, and you'll see visitors per page and country in that same Cloudflare screen.

### A3. Google Search Console: tell Google the site exists (10 min, after A1 works)
This is the most important step for being found on Google.
1. Open **search.google.com/search-console** and sign in with a Google account.
2. Click **Add property** → choose the right-hand box **URL prefix** → type `https://YOUR-DOMAIN/` → **Continue**.
3. Under *Other verification methods* open **HTML tag** and copy only the part inside `content="…"`. **Send it to me.**
4. When I say it's published, click **Verify** on that same page.
5. In the left menu: **Sitemaps** → type `sitemap.xml` → **Submit**. It lists all 72 pages.

### A4. Bing (2 min, after A3)
Open **bing.com/webmasters**, sign in, choose **Import from Google Search Console** and allow it. Done: no code needed. Bing also feeds DuckDuckGo, Ecosia and some AI search tools.

**Send me in total:** the domain (A1), the Cloudflare token (A2) and the Google code (A3). I run one command and publish.

---

## Part B: tell people it exists (1–2 hours over 2 weeks)

Google trusts a new site faster when other sites link to it, and the first users come from places where people look for tools. **What each one is:**

| Where | What it is | Worth it? |
|---|---|---|
| **AlternativeTo.net** | A site where people search "alternatives to X". You make a free account, click **Add application**, and paste the texts below. Add Punkto as an alternative to "Keep the Score", "Flippity", "Classroomscreen" and "Scoreboard". | ⭐ **Yes, do this first** |
| **Teacher / quiz groups** | Facebook groups and Reddit communities where teachers or quiz hosts ask for tools. You post once, as the maker, with the Reddit text below. | ⭐ **Yes, 2–4 posts** |
| **Product Hunt** | A daily list of new apps that tech people browse. Free account → **Submit** → paste texts, upload 3–4 screenshots. | Optional |
| **Hacker News "Show HN"** | A forum for programmers. Post the "Show HN" text and answer comments for an hour. | Optional |

Where to post as the maker:
- **Teachers:** Facebook groups in German, Polish, Czech, Dutch or Turkish (search "Lehrer Ideen", "nauczyciele", "učitelé", "leerkrachten", "öğretmenler"), and Reddit's r/edtech.
- **Quiz hosts:** Reddit's r/pubquiz and r/trivia.
- **Game nights:** Reddit's r/boardgames, but only in its weekly self-promotion thread.

House rules: post **once** per group, say you made it and that it's free, ask for feedback, and read each group's rules first. Many only allow self-promotion in one weekly thread.

---

## Part C: money switches (later, when visitors arrive)

- **Ads (Google AdSense):** apply once Part A is done and Google shows your pages, usually after 2–4 weeks. README §4 has the steps. Send me the publisher ID and the two ad-unit numbers, and I'll put them in.
- **"Remove ads forever" (Lemon Squeezy):** README §5. Send me the checkout link and the store/product numbers.

## Every month (10 minutes)

Open Search Console → **Performance**, scroll to **Queries**, take a screenshot and send it to me. I'll rewrite titles for pages people see but don't click, and add pages for searches we don't cover yet. Expect the first real numbers after 1–3 months. New sites start slowly, and that's normal.

## Don't

- Don't buy links, traffic or "SEO packages". Google penalises sites for it.
- Don't post the same text in many groups on the same day. It gets flagged as spam.
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
