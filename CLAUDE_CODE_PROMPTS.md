# Claude Code Prompts — Phase by Phase

Drop these into Claude Code as you start each phase. Each one assumes the previous phases are done. Adapt as needed.

## Phase 0 — Project setup

> I'm building a Mariners daily report app called "The M's Minute." I have a working React prototype in `ms-minute-prototype.jsx` and full context in the README plus PRODUCT, DESIGN, ARCHITECTURE, OPTIMIZATIONS, and GAPS docs. Please read all of those first.
>
> Set up a project with:
> - A Vite React frontend (TypeScript or JS, your call)
> - An Express backend in a `server/` folder
> - A shared `.env` for `ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`, `TWILIO_*` etc.
> - Wire up `npm run dev` to run frontend and backend concurrently
> - Frontend dev server proxies `/api/*` to the backend
>
> Keep it simple — no Docker, no monorepo tooling. One `package.json` per side is fine. Don't generate any UI yet — we'll port the prototype next.

## Phase 1 — MLB Stats API integration

> Now build the MLB Stats API integration. Reference `ARCHITECTURE.md` for the endpoints. Mariners team ID is 136.
>
> Create `server/lib/mlb.js` with these functions:
> - `getLastGame()` — returns the most recent completed Mariners game, with score, opponent, venue, date, and the game's `gamePk` ID
> - `getBoxScore(gamePk)` — returns top 3-4 Mariners offensive performers (sorted by hits + 2*HR + RBI) plus the starting pitcher's line
> - `getNextGame()` — next scheduled Mariners game with probable pitcher
> - `getStandings()` — AL West standings sorted by division rank
> - `getLiveGame(gamePk)` — current state of a live game (inning, score, base runners) for the SMS alert watcher
>
> No API key needed for MLB. Use plain fetch. Add a small in-memory cache so we don't hammer their servers.

## Phase 2 — Report generation

> Build the report generator. This runs once a day to produce the full report.
>
> Create `server/lib/generate.js` with a function `generateDailyReport()` that:
> 1. Calls the MLB lib functions in parallel to gather all the structured data
> 2. Detects an interesting stat from the box score (use the rules in `GAPS.md` #7)
> 3. Calls Claude (Haiku 4.5) to write the 3-sentence narrative recap
> 4. Calls Claude (Haiku 4.5) to write per-player one-line journalist notes
> 5. Calls Claude (Haiku 4.5) to write the "Stat of the Game" explanation
> 6. Calls YouTube Data API v3 to find the most recent Mariners highlight video on the MLB channel (UCqzDdCzAprzCNhNUtM8omcQ)
> 7. Returns one `Report` object matching the shape the frontend expects
>
> Use the system prompt caching pattern from `OPTIMIZATIONS.md` #4. Run all the Claude calls in parallel where possible. Use the voice rules from `PRODUCT.md`.

## Phase 3 — API endpoint and caching

> Build the report API.
>
> - `GET /api/report` — returns today's report. If we have a cached one for today, serve it. If not, generate it (calling `generateDailyReport`) and cache it.
> - Use SQLite for cache persistence. One table: `reports(date TEXT PRIMARY KEY, json TEXT, created_at INTEGER)`.
> - Add a manual `POST /api/report/regenerate` (auth-protected with a simple env-var token) for me to force regeneration during development.

## Phase 4 — Daily cron

> Schedule report generation.
>
> - Add a node-cron job that runs every day at 11:00 AM Pacific Time
> - Calls `generateDailyReport()`, writes to the cache
> - Logs success/failure
> - On failure, retries up to 3 times with exponential backoff
> - Has a manual entrypoint `npm run generate` for testing

## Phase 5 — Frontend port

> Port the prototype to the new frontend.
>
> Take `ms-minute-prototype.jsx` and adapt it:
> - Move each section component into its own file under `src/components/`
> - Keep all the styling and design exactly as-is — don't touch the visual system
> - Replace the entire `loadReport()` function with a single `fetch('/api/report')` call. The backend now returns the full Report object so no client-side prompting needed.
> - Keep the progressive rendering pattern in case the backend ever streams partial data
> - Keep the hourly session cache as a defense in depth

## Phase 6 — Phone signup & Twilio

> Build phone number signup and SMS sending.
>
> - Add a Settings page accessible from the bottom of the report
> - User enters phone number, we send a 6-digit code via Twilio Verify
> - On code confirmation, save the number to a `subscribers(phone TEXT PRIMARY KEY, verified_at INTEGER, unsubscribed_at INTEGER)` table
> - Add a Twilio webhook for inbound SMS that handles the STOP keyword (sets `unsubscribed_at`)
> - Wrap Twilio calls in `server/lib/sms.js` with a `sendSms(to, body)` function and a feature flag for dev mode that just logs

## Phase 7 — Live game watcher

> Build the SMS alert watcher. This is the killer feature.
>
> Create `server/lib/gameWatcher.js`:
> - On startup, check today's schedule for a Mariners game
> - If there's a game, schedule a job to start polling `getLiveGame(gamePk)` every 60 seconds starting 30 minutes before first pitch
> - Trigger condition: `currentInning >= 7 && Math.abs(homeScore - awayScore) <= 2 && !alertedGames.has(gamePk)`
> - When triggered: send an SMS to all verified subscribers with a message like "M's are in a nail-biter — 5-4 in the 8th. Turn it on." Pull the actual score from live data.
> - Mark the game as alerted in a `game_alerts(game_pk INTEGER PRIMARY KEY, alerted_at INTEGER)` table so we don't spam
> - Stop polling when game is final
>
> Add a feature flag to disable the watcher in dev. Add a manual test command `npm run test-alert` that sends one SMS to my number with a fake message.

## Phase 8 — Polish

After everything else works, prompt Claude Code with whichever of these you care about:

- Error recovery and retries
- Deployment to Railway/Fly/Vercel
- Analytics
- PWA / offline support
- Yesterday's-alert recap in the next day's report
- Stats glossary that builds up over time

## Tips for working with Claude Code on this

1. **Reference the docs by filename** in your prompts. Claude Code will read them. "See GAPS.md #7" is more useful than re-explaining.
2. **Keep `ms-minute-prototype.jsx` around** as your visual source of truth — when porting components, point Claude Code at it directly.
3. **Build the data layer first**, then the writing layer, then the SMS layer. Each one validates the previous.
4. **Test with real Mariners data** as you go. The MLB Stats API is free and live; there's no excuse for using mock data.
5. **The system prompt caching matters more in production.** Make sure each Claude call uses the same `SYS_VOICE` system prompt with `cache_control: { type: "ephemeral" }`.
