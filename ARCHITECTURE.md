# Architecture — Current and Target

## How the prototype works today

The prototype is a single React component that runs as a Claude.ai artifact. Everything is client-side — there's no backend, no scheduled job, no database.

### Data flow on each load

```
[User opens app]
        │
        ▼
[Check window.storage cache for current hour]
        │
   ┌────┴────┐
   ▼         ▼
[Hit]    [Miss — proceed]
Render          │
instant         ▼
            ┌─────────────────────────────────────────┐
            │           BATCH A (parallel)            │
            │  ┌──────────────┐  ┌─────────────────┐  │
            │  │ Sonnet +     │  │ Sonnet +        │  │
            │  │ web_search:  │  │ web_search:     │  │
            │  │ game facts,  │  │ YouTube video   │  │
            │  │ box score,   │  │ ID search       │  │
            │  │ standings,   │  │                 │  │
            │  │ next game,   │  │                 │  │
            │  │ stat fact    │  │                 │  │
            │  └──────────────┘  └─────────────────┘  │
            └─────────────────────────────────────────┘
                              │
                              ▼
            [Render score, lineup, standings, next game, YouTube]
                              │
                              ▼
            ┌─────────────────────────────────────────┐
            │           BATCH B (parallel)            │
            │  ┌──────────────┐  ┌─────────────────┐  │
            │  │ Haiku:       │  │ Haiku:          │  │
            │  │ narrative    │  │ stat            │  │
            │  │ recap        │  │ explanation     │  │
            │  └──────────────┘  └─────────────────┘  │
            └─────────────────────────────────────────┘
                              │
                              ▼
                     [Render recap + stat]
                              │
                              ▼
                       [Cache result]
```

### Why this design

- **Two parallel batches** because the writing tasks (Batch B) need the facts (Batch A) but the YouTube search is independent.
- **Sonnet for data, Haiku for writing** — Sonnet handles the harder reasoning over search results, Haiku writes prose 2x faster and 5x cheaper.
- **Cached system prompt** — the voice rules + JSON formatting instructions are sent once, then 10% cost on subsequent calls within ~5 minutes.
- **Hourly session cache** — same-hour reloads bypass all API calls.
- **Progressive rendering** — score and lineup show up first, narrative and stat fill in shortly after with skeleton loaders in their place.

### What's good about this for a prototype

- Zero infrastructure — just an HTML/JSX file
- Easy to iterate on prompts and visual design
- Works offline-ish via session cache after first load
- AA-compliant accessible

### What's bad about this for production

- Web search is slow and expensive compared to a real API
- Claude has to "find" facts that are available as plain JSON elsewhere
- No way to schedule a noon delivery — user has to open the app
- No way to send SMS — that requires a server
- Live game watching for the alert feature can't run in the browser
- API keys exposed in the client (the artifact environment hides this, but a real deploy can't)

## Target architecture

The goal: a real production app with a backend service that can run scheduled jobs and send SMS, while keeping the same React frontend.

```
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND (React)                       │
│  Opens at noon, fetches from /api/report, renders            │
│  Same UI as the prototype — just changes the data fetch      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ GET /api/report
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND (Node)                         │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  GET /api/report                                      │  │
│  │   1. Check Redis/SQLite cache for today's report     │  │
│  │   2. If missing, generate it (see below)             │  │
│  │   3. Return JSON                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Daily cron at 5am PT                                 │  │
│  │   1. Fetch yesterday's game from MLB Stats API       │  │
│  │   2. Build report shell from MLB JSON (instant)      │  │
│  │   3. Call Claude (Haiku) for narrative + stat        │  │
│  │   4. Search YouTube Data API for video ID            │  │
│  │   5. Cache full report                                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Live game watcher (only during games)                │  │
│  │   1. Poll MLB Stats API every 60s when game live     │  │
│  │   2. If inning >= 7 AND |home-away| <= 2:            │  │
│  │       → Twilio SMS to subscribed numbers             │  │
│  │       → Mark this game as "alerted" so we only fire  │  │
│  │         once per game                                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data layer changes

The biggest shift is moving game data from web-search-based scraping to the official MLB Stats API.

**Today:**
```
Claude + web_search → "Find the most recent Mariners game" → JSON
```
~15–25 seconds per call, costs API tokens, occasionally hallucinates.

**Target:**
```
fetch('https://statsapi.mlb.com/api/v1/schedule?teamId=136&date=...')
```
Sub-second, free, official, consistent schema.

### Endpoints you'll use from MLB Stats API

| Need | Endpoint |
|------|----------|
| Last game result | `/api/v1/schedule?sportId=1&teamId=136&date=YYYY-MM-DD` |
| Box score | `/api/v1/game/{gamePk}/boxscore` |
| Live game state | `/api/v1.1/game/{gamePk}/feed/live` |
| Standings | `/api/v1/standings?leagueId=103&season=YYYY` |
| Next game | Same schedule endpoint, future date |

Mariners team ID is `136`.

### What Claude is still for

Even after the data layer migration, Claude (Haiku) handles:
- 3-sentence narrative game recap
- Per-player one-line journalist notes
- Stat of the Game explanation in plain English

These are genuinely hard — they require taste, voice, and context. Don't try to template them.

### Stack recommendation

- **Backend:** Node.js + Express or Fastify, deployed on Railway/Fly/Vercel
- **Database:** SQLite (with Litestream for backup) or Postgres
- **Cache:** In-memory + persistent on disk; reports change once a day
- **Cron:** Whatever your platform offers (Vercel Cron, Railway Cron, plain node-cron)
- **SMS:** Twilio (most common, cheap)
- **YouTube:** YouTube Data API v3 (free with Google API key, 10k units/day)

### Frontend changes

Almost none. The React component stays mostly the same — just swap the API client. Replace the entire `loadReport()` function with one fetch:

```jsx
async function loadReport() {
  setLoading(true);
  try {
    const res = await fetch('/api/report');
    const data = await res.json();
    setFacts(data.facts);
    setGameData(data.facts.lastGame);
    setOffense(data.offense);
    setNarrative(data.narrative);
    setStatOfGame(data.statOfGame);
    setYtVideoId(data.ytVideoId);
  } catch (err) {
    setError(err.message);
  }
  setLoading(false);
}
```

That's it. The components, the styling, all the design work — keep all of it.
