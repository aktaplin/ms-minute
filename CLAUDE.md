# The M's Minute — Claude Code Context

## What this is

A daily Seattle Mariners briefing: game recap, player highlights, stat explained in plain English, and an SMS alert when a live game gets tight in the late innings. Mobile-first, broadsheet-newspaper style.

## Current state

Phases 0–5 are done (multi-team: 6 editions via `TEAM_CONFIGS` in `server/lib/mlb.js`):
- `server/lib/mlb.js` — MLB Stats API (schedule, box score, standings, wild card, play-by-play, live feed, pitch arsenal)
- `server/lib/generate.js` — daily report generator (Claude Haiku, YouTube API, Odds API)
- `server/lib/db.js` — SQLite cache (`reports`, `odds_history`); `server/lib/cron.js` — 5am PT daily job
- `server/lib/history.js` + `server/content/history/{teamKey}.json` — "On This Day" curated franchise moments
- `client/src/components/MsMinute.jsx` — full UI, responsive at 900px. There are no
  lettered zones and no jump-nav: every card is a peer top-level section, each flagged
  by `SectionHead` (full-width rule + small-caps label). Order: Last Game, Recap, Line Score
  (desktop only — on mobile it stays inside the score card), At the Plate, Pitching
  (Pitch Arsenal rides inside it), Game Highlights, Stat of the Game, On This Day,
  Standings, Next Game, WS Odds.
  mobile = that list in one column;
  desktop = newspaper front page: a full-width header band (Haiku lede + score card,
  which splits its meta into three panels at that width) running clear across the page,
  then main well + right rail below it — so the rail's first flag (Standings) starts
  level with Recap. The line score leaves the score card on desktop and runs as its own
  flagged section in the well, under the Recap.
  In the main well every block below the header runs the full well width and flows in
  two newspaper columns — Recap, At the Plate, Pitching, Stat of the Game — stacked
  vertically so a long Pitching card can't strand white space beside a short one.
  Rules are minimal: one 1px hairline at one ink (`RULE` via `ink()`), spent only on
  the masthead, the footer, the main-well section flags, and the two buttons. The rail's
  flags carry no rule (they rank by type alone); table rows, batters, pitch rows and
  in-card asides are separated by space, and the stat chips, the On This Day outline and
  the YouTube frame are gone. The only other horizontals are the wild card cut line and
  the active tab's underline, both of which mark something rather than divide something.
  No vertical rules anywhere — gutters do that work. See DESIGN.md.
  Daily Haiku headline as the Fraunces lede.

Phase 6 (phone signup + Twilio SMS) is next; Phase 7 (live game watcher) after that.
`GET /api/dev/report?team=` regenerates on demand (open locally; Bearer REGEN_TOKEN in production);
`POST /api/report/regenerate` (Bearer REGEN_TOKEN) busts cache. All `/api` routes are rate-limited per IP.

**Season-intelligence track (separate from the SMS phases):** **Beat Report** is
designed but NOT built — full spec in `BEAT_REPORT.md`: an RSS-driven "outside voices"
digest that curates (does not summarize) ~3–4 beat articles, ranked by relevance to
today's game via Haiku, with feeds configurable in `server/content/feeds.json`. Start
there to build it. Caveat: the spec predates the removal of Season Storylines and the
lettered sections, and still describes both — adapt it as you build.

## Build order

1. **Phase 1** — `server/lib/mlb.js` — MLB Stats API (no key needed, Mariners teamId=136) ✅
2. **Phase 2** — `server/lib/generate.js` — daily report generator (Claude Haiku + YouTube API) ✅
3. **Phase 3** — `GET /api/report` endpoint + SQLite cache ✅
4. **Phase 4** — node-cron daily job (5am PT) ✅
5. **Phase 5** — Port `ms-minute-prototype.jsx` into `client/src/components/`, swap `loadReport()` to fetch from backend ✅
6. **Phase 6** — Phone signup + Twilio SMS
7. **Phase 7** — Live game watcher (poll MLB every 60s, fire SMS when inning ≥7 and score within 2)

Steps 1–5 = real production app (done). Steps 6–7 = killer feature.

### Explainer features (shipped July 2026)

- **Pitch Arsenal** — starter's per-pitch mix from the game feed (`getStarterArsenal` in mlb.js:
  usage %, avg/max velo, whiffs) vs. season norms (`stats=pitchArsenal`), rendered as compact rows
  in the "Pitching" card right under the starter paragraph — numbers straight from the
  API, no Haiku prose layer. (The old standalone card + per-pitch teaching notes are
  archived in `archive/pitch-arsenal-standalone/`.)
- **On This Day** — `server/content/history/{teamKey}.json` keyed by `MM-DD`, one event per date
  (`year`, `headline`, `story`); prose is pre-written in the site voice and every event must be
  web-verified (Baseball-Reference / MLB.com) before it ships. Mariners file only, so far; the card
  hides for teams/dates with no entry.
- **Hitter Spotlight** — removed from the live app (July 2026) to cut API calls/compute; code is
  preserved in `archive/hitter-spotlight/` with restore instructions if it's worth bringing back.

### Wild Card standings (shipped August 2026)

- **Wild Card** — `getWildCard(leagueId)` in mlb.js derives the league's wild card race from the
  same regularSeason standings payload the division table already fetches (cached by path, so it
  costs no extra request): division leaders dropped, the rest ranked by winning percentage, WCGB
  computed against the cut line — teams holding a spot show how far they sit ahead of the first
  team out (`+2.0`), chasers how far back of the last spot (`2.0`). Rendered by `WildCardTable`, one of
  the two views inside the tabbed `StandingsCard` (Division / Wild Card, defaulting to Wild
  Card): three spots, a "cut line" rule, the next two chasing, and the team's own row after a
  break when it sits further back. A team missing from the list is leading its division — the
  table says so instead of highlighting a row.
- **Form trend** — each wild card row carries an L10 arrow. `getLeagueForm()` drops the `teamId`
  filter from the schedule endpoint, so one call returns every team's recent games (last 10 per
  team, plus the active streak) instead of fifteen per-team calls. `_formTrend` scales the record
  to a per-10 basis and buckets it into tiers −3…+3, rounding away from zero so a slide never
  grades softer than the mirror-image surge; under 6 games is too thin to call and returns null.
  `TrendGlyph` puts direction in the arrow's *shape* (so it survives colour loss) and intensity in
  three redundant channels — arrowhead size, ink depth, and a doubled head at ±3 — with the actual
  L10 record alongside, since an arrow on its own is a mood, not a number.

## Key reference docs

- `PRODUCT.md` — user, feature priorities, voice/tone
- `ARCHITECTURE.md` — current vs. target architecture, MLB API endpoints, stack choices
- `GAPS.md` — what's missing, in priority order, with build specs per gap
- `DESIGN.md` — visual system, palette, typography
- `OPTIMIZATIONS.md` — 7 perf optimizations already in the prototype
- `BEAT_REPORT.md` — spec for the Beat Report (RSS "outside voices" digest), designed but not yet built
- `CLAUDE_CODE_PROMPTS.md` — ready-to-use prompts for each phase
  (the original `ms-minute-prototype.jsx` UX reference was ported in Phase 5 and deleted; see git history)

## Key decisions

- Backend: Node/Express in `server/`, never expose API keys to client
- DB: SQLite, one `reports` table (date PK, json, created_at)
- Claude: Haiku for all writing. The four game sections (headline, recap, player notes, pitching)
  are generated in ONE call and fact-checked in ONE call (`_generateVerifiedGameSections`). No
  `cache_control` anywhere — these prompts are far below Haiku 4.5's 4096-token minimum cacheable
  prefix, so a cache breakpoint would be a silent no-op.
- MLB API: free, no key, base URL `https://statsapi.mlb.com`
- SMS: Twilio; wrap in `server/lib/sms.js` with a dev-mode log flag
- YouTube: Data API v3, MLB channel ID `UCoLrcjPV5PbUrUyXq5mjc_A`
