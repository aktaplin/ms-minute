# The M's Minute — Claude Code Context

## What this is

A daily Seattle Mariners briefing: game recap, player highlights, stat explained in plain English, and an SMS alert when a live game gets tight in the late innings. Mobile-first, broadsheet-newspaper style.

## Current state

Phase 0 (scaffold) is done:
- `client/` — Vite React app, placeholder UI
- `server/index.js` — Express server, just a `/api/health` endpoint
- Root `package.json` runs both with `npm run dev`

Phase 1 is next: MLB Stats API integration (`server/lib/mlb.js`).

## Build order

1. **Phase 1** — `server/lib/mlb.js` — MLB Stats API (no key needed, Mariners teamId=136)
2. **Phase 2** — `server/lib/generate.js` — daily report generator (Claude Haiku + YouTube API)
3. **Phase 3** — `GET /api/report` endpoint + SQLite cache
4. **Phase 4** — node-cron daily job (11am PT)
5. **Phase 5** — Port `ms-minute-prototype.jsx` into `client/src/components/`, swap `loadReport()` to fetch from backend
6. **Phase 6** — Phone signup + Twilio SMS
7. **Phase 7** — Live game watcher (poll MLB every 60s, fire SMS when inning ≥7 and score within 2)

Steps 1–5 = real production app. Steps 6–7 = killer feature.

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
