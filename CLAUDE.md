# The M's Minute — Claude Code Context

## What this is

A daily Seattle Mariners briefing: game recap, player highlights, stat explained in plain English, and an SMS alert when a live game gets tight in the late innings. Mobile-first, broadsheet-newspaper style.

## Current state

Phases 0–5 are done (multi-team: 6 editions via `TEAM_CONFIGS` in `server/lib/mlb.js`):
- `server/lib/mlb.js` — MLB Stats API (schedule, box score, standings, play-by-play, live feed, pitch arsenal)
- `server/lib/generate.js` — daily report generator (Claude Haiku, YouTube API, Odds API)
- `server/lib/db.js` — SQLite cache (`reports`, `odds_history`, `standings_history`); `server/lib/cron.js` — 5am PT daily job
- `server/lib/history.js` + `server/content/history/{teamKey}.json` — "On This Day" curated franchise moments
- `server/lib/storylines.js` — season "Storylines" threads (win/losing streak, last-10 form, division momentum, standings position)
- `client/src/components/MsMinute.jsx` — full UI, responsive at 900px:
  mobile = single column with sticky GAME/LEARN/LEAGUE jump-nav and three zones
  (Section A "The Game", Section B "Learn the Game" with Pitch Arsenal / Hitter Spotlight /
  Stat of the Game / On This Day, Section C "Around the League");
  desktop = newspaper front page (main well + right rail with vertical rule, two-column recap,
  Learn as a two-across spread), no nav. Daily Haiku headline as the Fraunces lede.

Phase 6 (phone signup + Twilio SMS) is next; Phase 7 (live game watcher) after that.
`GET /api/dev/report?team=` regenerates on demand; `POST /api/report/regenerate` (Bearer REGEN_TOKEN) busts cache.

**Season-intelligence track (separate from the SMS phases):** Season Storylines is
shipped (see below). **Beat Report** is designed but NOT built — full spec in
`BEAT_REPORT.md`: an RSS-driven "outside voices" digest in Section C that curates
(does not summarize) ~3–4 beat articles, ranked by relevance to today's game via
Haiku, with feeds configurable in `server/content/feeds.json`. Start there to build it.
v1 includes Tier-1 storyline linkage (ranker tags each article with its active
thread); a Tier-2 persistent thread↔article "dossier" is the planned next step.

## Build order

1. **Phase 1** — `server/lib/mlb.js` — MLB Stats API (no key needed, Mariners teamId=136) ✅
2. **Phase 2** — `server/lib/generate.js` — daily report generator (Claude Haiku + YouTube API) ✅
3. **Phase 3** — `GET /api/report` endpoint + SQLite cache ✅
4. **Phase 4** — node-cron daily job (5am PT) ✅
5. **Phase 5** — Port `ms-minute-prototype.jsx` into `client/src/components/`, swap `loadReport()` to fetch from backend ✅
6. **Phase 6** — Phone signup + Twilio SMS
7. **Phase 7** — Live game watcher (poll MLB every 60s, fire SMS when inning ≥7 and score within 2)

Steps 1–5 = real production app (done). Steps 6–7 = killer feature.

### Learn-zone features (shipped July 2026)

- **Pitch Arsenal** — starter's per-pitch mix from the game feed (`getStarterArsenal` in mlb.js:
  usage %, avg/max velo, whiffs) vs. season norms (`stats=pitchArsenal`); Haiku writes one teaching
  line per pitch + a usage-delta insight, grounded strictly in the provided numbers.
- **On This Day** — `server/content/history/{teamKey}.json` keyed by `MM-DD`, one event per date
  (`year`, `headline`, `story`); prose is pre-written in the site voice and every event must be
  web-verified (Baseball-Reference / MLB.com) before it ships. Mariners file only, so far; the card
  hides for teams/dates with no entry.

### Season Storylines (shipped July 2026)

- **Storylines** — `server/lib/storylines.js` builds up to 3 season "threads" that carry game-to-game,
  rendered as a badge + one-line card at the top of "Around the League" (Section C / desktop rail).
  Threads: win/losing streak and last-10 form (computed fresh from `getRecentResults` schedule walk —
  drift-proof, no stored state), division momentum (games gained/lost over the trailing window, from
  the new `standings_history` snapshot table, mirroring `odds_history`), and a standings-position
  fallback so the card is never empty. Every thread is fully grounded: the module computes exact
  numbers + a deterministic fallback sentence, Haiku only rewrites for voice, and the sentence is
  fact-checked (`verify.js`) against `factsBlock` — flagged threads revert to the template.

## Key reference docs

- `PRODUCT.md` — user, feature priorities, voice/tone
- `ARCHITECTURE.md` — current vs. target architecture, MLB API endpoints, stack choices
- `GAPS.md` — what's missing, in priority order, with build specs per gap
- `DESIGN.md` — visual system, palette, typography
- `OPTIMIZATIONS.md` — 7 perf optimizations already in the prototype
- `BEAT_REPORT.md` — spec for the Beat Report (RSS "outside voices" digest), designed but not yet built
- `CLAUDE_CODE_PROMPTS.md` — ready-to-use prompts for each phase
- `ms-minute-prototype.jsx` — canonical UX reference; keep all styling from this

## Key decisions

- Backend: Node/Express in `server/`, never expose API keys to client
- DB: SQLite, one `reports` table (date PK, json, created_at)
- Claude: Haiku for all writing (narrative, player notes, stat explanation); prompt cache the voice system prompt
- MLB API: free, no key, base URL `https://statsapi.mlb.com`
- SMS: Twilio; wrap in `server/lib/sms.js` with a dev-mode log flag
- YouTube: Data API v3, MLB channel ID `UCoLrcjPV5PbUrUyXq5mjc_A`
