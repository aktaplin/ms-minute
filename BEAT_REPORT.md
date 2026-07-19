# Beat Report — Spec

Status: **designed, not built** (spec only). Sibling to the Season Storylines
feature (`server/lib/storylines.js`). This is the "outside voices" layer: a
small, game-relevant digest of beat/press coverage in the "Around the League"
section.

## The idea (and what it is NOT)

A daily, curated set of ~3–4 recent beat articles that relate to *today's game*,
pulled from configurable RSS feeds.

The value is **curation, not summarization.** Summarizing a two-sentence RSS
blurb just rewrites something already short. What a reader can't get from a raw
feed is **selection, relevance, and framing** — which few articles matter, how
they connect to the game they just read about, and what the beat is collectively
focused on today. So the AI's job is to **pick the right few and make them read
as a set**, not to write N summaries.

Headlines are shown **verbatim** (the outlet's own words, attributed and linked).
We never rewrite a headline or put words in an outlet's mouth.

### Decisions locked (from the design interview)

| Decision | Choice |
|---|---|
| Format | Curated annotated links — real headline + outlet + link, **not** per-item summaries |
| Sources | MLB.com official team feed + one local beat per team, **configurable via a repo JSON file** so the owner can add their own sources |
| Placement | Around the League (Section C) — with standings, odds, storylines |
| Rollout | Mariners-only first (like the On This Day history file), then expand |
| Paywalls | Allow paywalled beats, but **label** them (e.g. a small "subscription" tag) |
| Coherence | **Connective lede + angle tags** — one short "what the beat is focused on today" line over the set, plus a 1–2 word angle tag per item (Postgame, Injury, Next up, Prospect…) |
| Relevance | **Haiku ranks by game context** — opponent, box-score players, starter, next opponent, and the active Storylines threads; it selects/orders the relevant items and drops off-topic noise |
| Summarize? | Only the single lead item, and only if its blurb is long enough to be worth it |
| Freshness | Relevance-to-game is the primary filter; also a recency window (~36h) and a cap (~4 items) |
| Storyline link | Tier 1 (ranker tags each article with its active thread) ships **with v1**; Tier 2 (persistent thread↔article dossier) is the **next step**. See "Storyline linkage" below. |

## Architecture

Mirrors the Storylines / history.js patterns already in the codebase:
structured data + a thin Haiku layer + graceful degradation, driven by a
content file the owner can edit.

### 1. Config file — `server/content/feeds.json`

Keyed by `teamKey` (same convention as `content/history/{teamKey}.json`). Each
value is an array of feed objects. A team with no entry → the card silently
hides (exactly like On This Day).

```jsonc
{
  "mariners": [
    { "name": "MLB.com — Mariners", "url": "https://www.mlb.com/mariners/feeds/news/rss.xml", "kind": "official", "paywall": false },
    { "name": "Seattle Times — Mariners", "url": "<verified RSS url>", "kind": "beat", "paywall": true }
  ]
}
```

- `name` — display string used for attribution.
- `url` — RSS/Atom feed URL.
- `kind` — `official` | `beat` | `fan` (drives future safety handling; fan feeds
  would need a profanity/safety pass before shipping).
- `paywall` — boolean → renders the "subscription" label.

> ⚠️ **Feed URLs must be verified at build time.** They could not be fetched in
> the spec session (egress policy blocked `statsapi.mlb.com`; feed hosts like
> `mlb.com` / `seattletimes.com` will likewise need to be on the deploy
> environment's allowlist). Confirm each URL returns valid RSS before shipping.

### 2. New module — `server/lib/beat.js`

- `loadFeeds(teamKey)` → feed configs for the team (cached in-process, like
  `history._loadTeamHistory`). Missing/malformed file → `[]`, feature no-ops.
- `fetchFeedItems(feed)` → parse one feed → `[{ title, link, description,
  publishedAt, sourceName, paywall }]`. Best-effort: a failing feed is skipped,
  never throws (same posture as `getStarterArsenal` / `getHitterSpotlight`).
- `getCandidateItems(teamKey, { windowHours = 36, max = 15 })` → fetch all feeds
  in parallel, flatten, filter to the recency window, dedupe by normalized title,
  sort by recency, cap the pool. Returns the candidate list handed to the ranker.

**Dependency:** add `rss-parser` (small, standard, handles RSS + Atom variants).
Keep it isolated in `beat.js`.

### 3. `generate.js` integration

Slots into the existing flow next to Storylines (which already assembles the
game context this feature needs):

1. After `storylineCandidates` are built, assemble a `beatContext`:
   `{ opponent, result, keyPlayers (box-score names), starter, nextOpponent,
   storylineLabels }`.
2. `const beatCandidates = await beat.getCandidateItems(teamKey).catch(() => []);`
   (best-effort; empty → skip, card hides).
3. Add a `_generateVerifiedBeat(...)` call to the parallel `Promise.all` (same
   place as `_generateVerifiedStorylines`).
4. Merge → `report.beat = { lede, items: [...] } | null`.

### 4. The Haiku "wire editor" pass

Prompt (house-voice system prompt reused). The model **selects by index** and
never emits headline text — we reconstruct display items from our own fetched
data, so headlines/links can't be hallucinated.

Inputs:
- **Game context block:** opponent + result, key players, starter, next
  opponent, active storyline labels.
- **Candidate items:** numbered list of `index · source · headline · blurb`.

Ask for:
- The `N` (≤4) most relevant items to *this game / the team's current situation*,
  ordered; drop off-topic items (return fewer than N if that's the honest set).
- A 1–2 word **angle** tag per item.
- One **connective lede** (≤ ~20 words) describing what the beat is focused on.
- Optionally, one **summary** sentence for the single lead item, only if its
  blurb is substantive.

Return JSON: `{ "lede": "...", "items": [{ "index": 2, "angle": "Injury",
"summary": "..." }, ...] }`.

Post-processing:
- Clamp `index` to real candidates; drop invalid ones.
- Rebuild each display item from the **fetched** data (`title`, `link`,
  `sourceName`, `paywall`) + Haiku's `angle`/`summary`.
- On parse failure / refusal / empty selection → **fallback**: show the top 2–3
  candidates by recency as plain headline + source + link, no lede, no tags.

### 5. Grounding & editorial safety

The fact-check surface is deliberately tiny:
- **Headlines are verbatim** outlet copy, attributed and linked — standard news
  aggregation, nothing asserted in our voice.
- The **only AI-written prose** is the lede (describes what coverage is *about*)
  and an optional lead summary. Neither should assert new baseball facts.
- Optional light check: run the lede/summary through `verify.findViolations`
  against a facts block of `{ game facts + the selected headlines }`. Lower
  stakes than the recap; the deterministic fallback is "no lede, just links."
- **Fan/Reddit feeds (future):** `kind: "fan"` items need a profanity /
  misinformation filter before they can ship in the house voice. Out of scope
  for v1 (official + beat only).

### 6. UI — `BeatReportCard` (Section C)

Same visual language as the other cards (`SectionHead`, INTER/FRAUNCES, teal/navy).

- `SectionHead label="Beat Report"`.
- **Lede** line at top: italic, muted, one sentence.
- **Items list**, each row:
  - small **angle** chip (teal, uppercase, letter-spaced),
  - **headline** as an external link (navy, weight 600; `target="_blank"
    rel="noreferrer"` like `YouTubeCard`),
  - **source** + `· subscription` when `paywall`,
  - optional **summary** line under the lead item only.
- Placement: mobile Section C, grouped with Storylines as "context"; desktop
  right rail. Renders only when `report.beat?.items?.length`. Exact ordering
  within Section C is a design detail to settle during build.

Client `loadReport` mapping: `beat: report.beat ?? null`. Add `data.beat?.items?.length`
to the League zone `show` conditions (as was done for `storylines`).

## Storyline linkage

The Beat Report and Season Storylines (`server/lib/storylines.js`) are designed
to reinforce each other. Two tiers, built in order.

> **Architectural note:** the shipped storylines are **stateless** — recomputed
> fresh each day and embedded in the report JSON; there is no persistent "thread"
> row. Tier 1 needs no state. Tier 2 adds a *thin* persistent identity anchor for
> threads. Crucially, the streak/momentum **numbers stay recomputed fresh**
> (drift-proof); the new tables only store thread identity + an article log, never
> the counts. So we keep the stateless design's drift-proofness and add
> persistence only where it pays off.

### Tier 1 — Ranker-level link (part of Beat Report v1)

The ranker already receives active storyline labels in its game context. The
addition: the "wire editor" pass tags each selected article with the **thread it
belongs to**, if any.

- Ranker JSON gains an optional `thread` field per item, e.g.
  `{ "index": 2, "angle": "Postgame", "thread": "streak:win" }`. Must be one of
  the active thread ids passed in, or omitted. Clamp/validate like `index`.
- UI: when an item has a `thread`, render its tag as the storyline label
  (`↳ Win Streak`) instead of / alongside the generic angle, optionally linking
  up to the Storylines strip.
- **Cost:** one output field + one UI touch. No schema change, no persistence.
- **Payoff:** same-day synergy — the strip states the thread, the beat shows the
  coverage of it.

### Tier 2 — Persistent thread ↔ article log (next step after v1)

Give threads a stable identity and accumulate their coverage across the season,
turning a storyline into a **dossier** ("the 8-game win streak → the articles the
beat wrote as it built").

```sql
CREATE TABLE IF NOT EXISTS storyline_threads (
  team_key   TEXT NOT NULL,
  thread_id  TEXT NOT NULL,   -- stable: 'streak:win', 'momentum:division', 'position:division'
  kind       TEXT,
  subject    TEXT,
  status     TEXT,            -- 'active' | 'ended'
  first_seen TEXT,
  last_seen  TEXT,
  peak_value REAL,
  PRIMARY KEY (team_key, thread_id)
);

CREATE TABLE IF NOT EXISTS storyline_articles (
  team_key     TEXT NOT NULL,
  thread_id    TEXT NOT NULL,
  article_url  TEXT NOT NULL,
  title        TEXT,
  source       TEXT,
  published_at TEXT,
  linked_on    TEXT,          -- report date this association was made
  PRIMARY KEY (team_key, thread_id, article_url)
);
```

Flow, folded into the daily `generate` run:
- `storylines.build` gains stable `thread_id`s (team-level threads are few and
  stable). Upsert active threads into `storyline_threads` (`first_seen` on first
  appearance, `last_seen` each run); flip to `status='ended'` when a thread stops
  appearing (e.g. a streak breaks) — a self-closing dossier.
- When the Tier-1 ranker attaches an article to a `thread`, insert it into
  `storyline_articles` (idempotent on url).
- Read back per-thread article lists to render an expandable coverage timeline on
  the Storylines card.

This schema is also the foundation for a **Tier 3** thread-detail view (the stat
arc from `standings_history` + the schedule, plus the press timeline from
`storyline_articles`) — a storyline that grows into its own little page. Not
scheduled; noted so Tier 2's schema is built with it in mind.

## Build checklist

**Beat Report v1 (includes Tier 1 linkage):**
1. `npm i rss-parser` in `server/`.
2. `server/content/feeds.json` with a verified Mariners entry (MLB + one beat).
3. `server/lib/beat.js` — `loadFeeds`, `fetchFeedItems`, `getCandidateItems`.
4. `generate.js` — assemble `beatContext` (incl. active storyline ids + labels),
   fetch candidates, `_generateVerifiedBeat` (ranker emits `thread` per item),
   merge `report.beat`, add to the verification audit array.
5. `MsMinute.jsx` — `BeatReportCard`, `loadReport` mapping, Section C render +
   zone `show` conditions (mobile + desktop rail); render `thread` tags.
6. Verify feed URLs return valid RSS in an environment where feed hosts are
   allowlisted; confirm the fallback path (feed down / no relevant items → card
   hides or degrades to plain links).
7. Update `CLAUDE.md` current-state + docs list.

**Tier 2 (next step):**
8. `storylines.build` emits stable `thread_id`s; `db.js` gains `storyline_threads`
   + `storyline_articles` tables and upsert/read accessors.
9. `generate.js` upserts active threads and logs Tier-1 article↔thread links.
10. Storylines card renders an expandable per-thread coverage list.

## Open questions for build time

- **Exact Section C ordering** (Beat above or below Standings/Storylines).
- **Card label** — "Beat Report" vs. "The Wire" / "Around the Beat."
- **Feed-fetch caching** — reuse an mlb.js-style short-TTL `_cache` for raw feeds
  so a manual regenerate doesn't re-hit every outlet.
- **Verified real feed URLs** for the Mariners (MLB.com team feed + a free-ish or
  clearly-paywalled local beat).
