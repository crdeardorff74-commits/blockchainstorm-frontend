# tantro-front-end — Session Notes

Newest entries on top. See universal rule 9 in `../../CLAUDE.md` for what belongs here.

## 2026-06-10 — Release v4.19
- Ships the SEO "Tantro" alias work (title/meta/JSON-LD/sr-only h1, canonical → tantro subdomain). Version bump busts the SW cache so crawlers/players get the new index.html.

## 2026-06-10 — SEO: ASCII "Tantro" alias (brand stays TANTЯO)
- Problem: `Я` is Cyrillic (U+042F), so Google had no ASCII "Tantro" signal — searching plain "Tantro" didn't surface the game. Fix adds the alias in SEO/a11y layers only; the TANTЯO brand and logo are unchanged.
- index.html: `<title>` + the load-time `document.title` now `TANTЯO (Tantro) — Free Online Falling Blocks Game`; meta description/keywords/og:title/twitter:title mention Tantro; added `VideoGame` JSON-LD with `alternateName: "Tantro"`; added a visually-hidden `<h1 class="sr-only">` carrying the ASCII spelling (also fixes a missing semantic heading — the visible logo is a styled div). `.sr-only` helper added to style.css.
- **Pitfall:** `window.GAME_TITLE` MUST stay pure `TANTЯO` — it feeds in-game UI. Only `document.title` / page meta carry the "(Tantro)" alias. Also `game.js:1396`/`1413` set `document.title` during gameplay/music, but that's post-load so it doesn't affect indexing.
- Fixed a pre-existing bug: `canonical` pointed at the `blockchainstorm.` subdomain while `og:url` pointed at `tantro.` — now both are `https://tantro.official-intelligence.art/` (the real front door; the blockchainstorm subdomain also works but isn't canonical).
- Verified live in preview (title, hidden h1, canonical, JSON-LD, no console errors). Off-page follow-up is the user's: Google Search Console request-indexing + "Tantro"-anchored backlinks.
