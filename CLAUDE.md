# The M's Minute — Claude Code Context

## What this is

A daily Seattle Mariners briefing: game recap, player highlights, stat explained in plain English, and an SMS alert when a live game gets tight in the late innings. Mobile-first, broadsheet-newspaper style.

## Current state

Phases 0–5 are done (multi-team: 6 editions via `TEAM_CONFIGS` in `server/lib/mlb.js`):
- `server/lib/mlb.js` — MLB Stats API (schedule, box score, standings, play-by-play, live feed, pitch arsenal)
- `server/lib/generate.js` — daily report generator (Claude Haiku, YouTube API, Odds API)
- `server/lib/db.js` — SQLite cache (`reports`, `odds_history`); `server/lib/cron.js` — 5am PT daily job
- `server/lib/history.js` + `server/content/history/{teamKey}.json` — "On This Day" curated franchise moments
- `client/src/components/MsMinute.jsx` — full UI: masthead, sticky section nav, three zones
  (Section A "The Game", Section B "Learn the Game" with Pitch Arsenal / Stat of the Game / On This Day,
  Section C "Around the Club"), team picker, per-team theming

Phase 6 (phone signup + Twilio SMS) is next; Phase 7 (live game watcher) after that.
`GET /api/dev/report?team=` regenerates on demand; `POST /api/report/regenerate` (Bearer REGEN_TOKEN) busts cache.

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

## Key reference docs

- `PRODUCT.md` — user, feature priorities, voice/tone
- `ARCHITECTURE.md` — current vs. target architecture, MLB API endpoints, stack choices
- `GAPS.md` — what's missing, in priority order, with build specs per gap
- `DESIGN.md` — visual system, palette, typography
- `OPTIMIZATIONS.md` — 7 perf optimizations already in the prototype
- `CLAUDE_CODE_PROMPTS.md` — ready-to-use prompts for each phase
- `ms-minute-prototype.jsx` — canonical UX reference; keep all styling from this

## Key decisions

- Backend: Node/Express in `server/`, never expose API keys to client
- DB: SQLite, one `reports` table (date PK, json, created_at)
- Claude: Haiku for all writing (narrative, player notes, stat explanation); prompt cache the voice system prompt
- MLB API: free, no key, base URL `https://statsapi.mlb.com`
- SMS: Twilio; wrap in `server/lib/sms.js` with a dev-mode log flag
- YouTube: Data API v3, MLB channel ID `UCoLrcjPV5PbUrUyXq5mjc_A`
