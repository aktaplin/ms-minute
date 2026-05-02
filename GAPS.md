# Gaps — What's Not Built Yet

The prototype works end-to-end as a UX demo, but several real-product gaps remain. Listed in roughly priority order.

## P0 — Blockers for any real deployment

### 1. API key is exposed in the client

The prototype calls `https://api.anthropic.com/v1/messages` directly from the browser. This works because the Claude.ai artifact environment proxies the request and injects the key. **In a real deployment, you cannot put your Anthropic API key in client-side code.** You must move all Claude calls to a backend.

**What to build:** A simple Node/Express (or similar) server with one or two endpoints that the frontend calls. The server holds the API key, the frontend never sees it.

### 2. No persistence — every load re-fetches everything

The prototype generates a fresh report every time the app loads (or once an hour, with the session cache). For a real app, the report should be generated **once per day** by a scheduled job and cached for all users.

**What to build:**
- A scheduled cron that runs once a day (around 11am PT, before the lunch crowd)
- Generates the report, caches it
- Frontend just fetches the cached version

### 3. No phone number signup / SMS infrastructure

The "turn the game on" text alert was a top user request and isn't built at all.

**What to build:**
- A simple phone number capture form (could be a separate page or a settings panel)
- Twilio integration for sending SMS
- Verification flow (Twilio Verify or magic link) so people can't sign up other people's numbers
- Unsubscribe flow (Twilio's STOP keyword handling)
- Database table for subscribed numbers

### 4. No live game watcher for the SMS alert

The trigger ("Mariners game in 7th+ inning, score within 2") requires polling MLB's live game feed during games and firing SMS when conditions match.

**What to build:**
- Background worker that:
  - Checks the schedule each morning to know if there's a Mariners game today
  - During game time, polls `https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live` every 30–60 seconds
  - Watches for the trigger condition (`currentInning >= 7 && Math.abs(homeScore - awayScore) <= 2`)
  - Fires one SMS to each subscriber when the trigger first hits, then marks the game as "alerted" so it doesn't fire again

## P1 — Important for a quality product

### 5. Web-search-based data fetching is slow and brittle

Currently the app asks Claude to search the web for game results, box scores, and standings. This is slow (15–25s) and occasionally returns hallucinated or stale data.

**What to build:** Replace with MLB Stats API calls. See `ARCHITECTURE.md` for the specific endpoints. This single change makes the app radically faster, cheaper, and more accurate.

### 6. YouTube video ID search is unreliable

The prototype asks Claude to search for the most recent Mariners highlight on the MLB YouTube channel and extract the video ID. This works sometimes — but not always — and adds latency.

**What to build:** Use the YouTube Data API v3 directly:

```
GET https://www.googleapis.com/youtube/v3/search
  ?part=snippet
  &channelId=UCqzDdCzAprzCNhNUtM8omcQ  (MLB official channel)
  &q=Seattle+Mariners+highlights
  &order=date
  &maxResults=1
  &key=YOUR_KEY
```

Free, official, deterministic.

### 7. Stat of the Game depends on Claude finding interesting context

The "Stat of the Game" card relies on Claude noticing something interesting in the box score. With proper data access (MLB Stats API), you could write deterministic logic to detect notable stats:

- Pitcher with WHIP under 1.00 in the start
- Hitter with multi-HR or 3+ RBI game
- Team with 12+ strikeouts at the plate
- Closer with a save in 1-run game

Then pass the detected stat + context to Claude for the explanation. This makes the section more reliably interesting.

### 8. No error recovery / retry logic

If a Claude call fails or returns malformed JSON, the whole app falls into the error state. Production-grade should retry transient failures, fall back to partial reports, or use cached data from yesterday.

### 9. No timezone handling

The app uses the browser's local time and assumes Pacific Time everywhere implicitly. For Mariners fans outside the PT zone, "yesterday's game" might mean different things. Should be explicit.

## P2 — Nice to have

### 10. No analytics

You can't tell what people read, when they open the app, or whether the SMS alerts work. Even basic page views and click-through on the YouTube embed would be useful.

### 11. No offline support

PWA with a service worker would let users open yesterday's report on the train when their cell signal is weak.

### 12. Stat education doesn't accumulate

Every day's stat is independent. A "stats glossary" or "you've learned about X stats" feature would reinforce the learning angle.

### 13. No "yesterday's text alert recap"

If you missed the text alert because your phone was on silent, you don't know there was a tight game. The next day's report could have a small "You missed: 7th-inning rally last night, M's came back from 4 runs down."

### 14. No multi-user support

There's no sense of "your account" — the app is the same for everyone. Personalization (favorite player, custom alert thresholds, preferred delivery time) would all need an account system.

### 15. Single-team only

By design today. Could be a feature: pick your team, get the same format for any MLB team. The MLB Stats API supports any team. Voice prompts would need to genericize.

## Build order suggestion

If you're starting fresh in Claude Code, build in this order:

1. **Backend skeleton** — Express server, env vars for API keys, one `/api/report` endpoint
2. **MLB Stats API integration** — replace web search with real API calls (#5)
3. **Daily cron** — generate report once a day, cache it (#2)
4. **YouTube Data API** — proper video lookup (#6)
5. **Frontend swap** — replace the prototype's `loadReport` to fetch from your backend (#1)
6. **Phone number signup** — capture form, database table (#3 part 1)
7. **Twilio integration** — send a test SMS to a hardcoded number (#3 part 2)
8. **Live game watcher** — the actual alert logic (#4)
9. **Error handling and retries** (#8)
10. **Everything else as you have time**

Steps 1–5 give you a real production app. Steps 6–8 deliver the killer feature. Beyond that is polish.
