# tantro-front-end — Session Notes

Newest entries on top. See universal rule 9 in `../../CLAUDE.md` for what belongs here.

## 2026-06-29 — Release v4.23
- Share links now point at `https://tantro.official-intelligence.art` instead of the itch.io page (`getShareURL()` in `game.js` ~line 11688). Feeds all 12 share buttons (popup + game-over row) and the Copy Link action.
- Version bumped 4.22 → 4.23 (`sw.js` APP_VERSION + `index.html` PAGE_VERSION). Not browser-verified — pure constant/URL change.
- Layout note: deployable files (`index.html`, `sw.js`, `game.js`, `NOTES.md`, etc.) had drifted into `tantro-back-end/` at a stale 3.62; user restored the canonical 4.22 set here in `tantro-front-end/` from git. This release is against the correct front-end folder. The orphaned copies in `tantro-back-end/` should be cleaned up.

## 2026-06-20 — Release v4.22
- Ships the credits-link tracking rework: per-id `sunoLinks` map replaced with a delegated `[data-credit-link]` handler, all 8 IDs renamed to descriptive slugs, and the admin tantro panel switched to listing the raw ID. See the detailed entry below.
- Backend (not in this zip): `suno_clicks` column widened to `VARCHAR(255)` in code; live DB still needs the manual `ALTER` + the ID-rename migration `UPDATE` before this ships meaningfully.

## 2026-06-20 — Credits link tracking ported to `data-credit-link` delegate
- Replaced the old per-id binding (hardcoded `sunoLinks` map + `getElementById` loop in game.js, anchors keyed by `id="creditsSuno1…6"`/`creditsSpotify`/`creditsApple`) with one delegated, capture-phase `click` handler at [game.js:11870](game.js) that walks up to any `[data-credit-link]` and calls the existing `trackSunoClick(label)`. Mirrors Circuitousness's `share.js` approach.
- **New convention: to track a credits link, just add `data-credit-link="<unique-label>"` to the anchor in index.html** — no map, no second file, works for anchors added later too. The label becomes the row in the admin `suno-clicked` breakdown.
- Label strings were preserved exactly (`artist`, `song1`…`song5`, `spotify`, `apple`) so the backend `suno_clicks` accumulator and admin stats stay continuous. Those old `id`s were referenced ONLY by the deleted map — safe to drop.
- Unchanged: ASPCA donate link still delegated to `#shareDonate` (lives in an i18n-rerendered string, so structural match not a data-attr). Backend endpoint stays `/suno-clicked` (TANTЯO-specific; Circuitousness uses `/credits-clicked`).
- Not yet released — needs `/rel` to bump version + re-zip. Static-verified only (no node/preview here): no leftover id/map refs, 8 attrs present, braces balance. A true click-through test needs the game-over credits scroll + live backend.
- **Follow-on (same day): all 8 IDs renamed to descriptive slugs + admin now shows the raw ID.** Front-end `data-credit-link` values are now `suno-digeratist`, `spotify` (unchanged), `apple-music`, `song-fd`, `song-final-score`, `song-grays-in-the-middle`, `song-consumption`, `song-dog-hi`. Admin tantro page (`official-intelligence-web/admin/tantro/index.html`) had its `sunoLabels`/`sunoColors`/`sunoIcons` maps deleted — it now lists the raw ID like Circuitousness's Credits Link Clicks panel.
- **Gotcha that motivated the rename:** the old admin `sunoLabels` was misaligned with the actual songs — `song3` was displayed as "Consumption" but `song3`'s anchor is really the Grays/"Malcolm in the Middle" song (→ `song-grays-in-the-middle`); the genuine Spontaneous Human Consumption anchor was `song4` (→ `song-consumption`). The stored data was always correct; only the pretty-name map lied. Showing the raw ID makes this class of mislabel impossible.
- **Backend column widened `VARCHAR(100)` → `VARCHAR(255)`** ([models.py:125], [app.py:68] startup ADD COLUMN) because the longer slugs overflow 100 (all 8 in one visit ≈ 115 chars → would 500 the `/suno-clicked` PATCH). Per-link cap stays `[:30]`; longest slug `song-grays-in-the-middle` = 25. **Live DB still needs a manual `ALTER TABLE page_visits ALTER COLUMN suno_clicks TYPE VARCHAR(255);`** — the code edits only cover fresh DBs.
- **Pending user actions (not done by me):** run the live-DB `ALTER` + the CSV-token rename migration `UPDATE` (PostgreSQL, comma-wrap + chained `REPLACE` over `page_visits.suno_clicks`, mapping `artist/apple/song1..song5` → the new slugs), then `/rel` to ship the front-end. SQL was provided in chat, not committed anywhere.

## 2026-06-16 — Release v4.21
- Global text-selection / iOS-callout disable in `style.css` (new universal rule 10): root `html { user-select:none; -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent; ... }`, re-enabled for `input, textarea, [contenteditable]`. Stops the iOS tap / tap-and-hold selection handles + magnifier from popping over the UI. Tantro already had scattered `user-select:none` but lacked the callout suppression.

## 2026-06-16 — Release v4.20
- New `platform-redirect.js` (loaded first in `<head>`): on mobile/tablet viewed from an itch.io embed, redirects to `tantro.official-intelligence.art` so "Add to Home Screen" installs the real PWA instead of bookmarking itch's listing page. Auto top-nav attempt + tap-fallback overlay (× to dismiss). Inert on desktop, in standalone PWA, and on our own origin. Added 15-language `redirect.*` i18n keys and the file to sw.js CORE_ASSETS.
- **Caveat to test on a real phone:** itch's in-page iframe sandbox likely blocks the silent auto-redirect (omits top-navigation, allows popups), so the tap overlay opening a new tab is the expected path on the listing page; seamless auto only fires when itch launches top-level (fullscreen).

## 2026-06-10 — SEO infra: sitemap/robots now point at tantro
- `sitemap.xml` and `robots.txt` previously pointed at the `blockchainstorm.` subdomain — fought the new tantro canonical AND likely caused Search Console's "Temporary processing error" (a sitemap of blockchainstorm URLs is rejected inside a tantro property). Both now point at `https://tantro.official-intelligence.art/` (sitemap also got a `lastmod`).
- Added `noindex, nofollow` to `ai-tuner.html` — it's an internal AI-tuning tool (still titled "TaNTЯiS"), shouldn't be in search.
- Re-zipped at the SAME v4.19 (app shell unchanged; these are static/SEO files, no SW cache-bust needed). The v4.19 zip from the earlier /rel predates these edits — deploy the regenerated one.
- Context for next session: the user's GSC history appears centered on a **blockchainstorm** property — both domains serve the game and both work, but tantro is now the declared canonical/primary. Live canonical already verified correct on both domains via curl. Pending user actions: deploy zip, (re)submit tantro sitemap in the tantro GSC property, Request Indexing for both URLs to consolidate onto tantro.
- Ships the SEO "Tantro" alias work (title/meta/JSON-LD/sr-only h1, canonical → tantro subdomain). Version bump busts the SW cache so crawlers/players get the new index.html.

## 2026-06-10 — SEO: ASCII "Tantro" alias (brand stays TANTЯO)
- Problem: `Я` is Cyrillic (U+042F), so Google had no ASCII "Tantro" signal — searching plain "Tantro" didn't surface the game. Fix adds the alias in SEO/a11y layers only; the TANTЯO brand and logo are unchanged.
- index.html: `<title>` + the load-time `document.title` now `TANTЯO (Tantro) — Free Online Falling Blocks Game`; meta description/keywords/og:title/twitter:title mention Tantro; added `VideoGame` JSON-LD with `alternateName: "Tantro"`; added a visually-hidden `<h1 class="sr-only">` carrying the ASCII spelling (also fixes a missing semantic heading — the visible logo is a styled div). `.sr-only` helper added to style.css.
- **Pitfall:** `window.GAME_TITLE` MUST stay pure `TANTЯO` — it feeds in-game UI. Only `document.title` / page meta carry the "(Tantro)" alias. Also `game.js:1396`/`1413` set `document.title` during gameplay/music, but that's post-load so it doesn't affect indexing.
- Fixed a pre-existing bug: `canonical` pointed at the `blockchainstorm.` subdomain while `og:url` pointed at `tantro.` — now both are `https://tantro.official-intelligence.art/` (the real front door; the blockchainstorm subdomain also works but isn't canonical).
- Verified live in preview (title, hidden h1, canonical, JSON-LD, no console errors). Off-page follow-up is the user's: Google Search Console request-indexing + "Tantro"-anchored backlinks.
