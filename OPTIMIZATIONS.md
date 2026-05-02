# Optimizations Applied

Seven optimizations are already implemented in the prototype. When you migrate to a real backend, most of these still apply — they're not artifact-specific. Two of them become obsolete (search-related) once you switch to the MLB Stats API.

## 1. Parallel API batching

**Problem:** Originally the app made calls serially: data → narrative → player stories. Each waiting for the previous.

**Fix:** Two parallel batches with `Promise.all`:
- Batch A: data search + YouTube ID search (no dependencies on each other)
- Batch B: narrative recap + stat explanation (both need Batch A's data, but can run in parallel with each other)

**Code:** `loadReport()` in the prototype.

**Carries over to backend?** Yes, exactly the same pattern.

## 2. Progressive rendering

**Problem:** Spinner blocks the entire page until everything finishes.

**Fix:** Each section renders the moment its data arrives. Score, lineup, standings, and YouTube show up after Batch A. Recap and stat fill in during Batch B with subtle skeleton loaders in their place.

**Code:** Each section is conditionally rendered against its own state variable; `<SectionSkeleton>` components fill the gaps.

**Carries over to backend?** Less critical when the backend pre-generates reports, but still useful for first-time loads.

## 3. Model routing — Haiku for prose, Sonnet for reasoning

**Problem:** Using Sonnet 4 for every call. Overkill for "write 3 sentences in a fan voice."

**Fix:**
- **Sonnet 4** for the data-gathering search call where reasoning over multiple search results matters
- **Haiku 4.5** for the narrative recap and stat explanation — both pure prose tasks

**Cost impact:** Roughly 5x cheaper for the writing calls. Roughly 2x faster.

**Code:** `MODEL_SONNET` and `MODEL_HAIKU` constants; `model` option on `callClaude`.

**Carries over to backend?** Absolutely — even more important when you're paying for production API usage.

## 4. Cached system prompt

**Problem:** Every call duplicated the voice rules and JSON formatting instructions in the user prompt.

**Fix:** Extracted shared instructions into a single `SYS_VOICE` system prompt with `cache_control: { type: "ephemeral" }`. First call pays full price, subsequent calls within ~5 minutes pay 10% on the cached tokens.

**Code:**
```js
const SYS_VOICE = `You write for The M's Minute, a daily Seattle Mariners fan newsletter...`;

const system = systemPrompt
  ? [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }]
  : undefined;
```

**Carries over to backend?** Yes, and even more impactful — your scheduled job runs many calls in quick succession.

## 5. Web search budget caps (`max_uses`)

**Problem:** Claude could go on a multi-search fishing expedition that runs up time and tokens.

**Fix:** Capped each search-enabled call to a sensible maximum:
- Data search: `max_uses: 3`
- YouTube search: `max_uses: 2`

**Code:**
```js
tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }]
```

**Carries over to backend?** **No — this becomes obsolete** once you switch to MLB Stats API. You won't be using web search for game data at all.

## 6. Tighter `max_tokens` per call

**Problem:** Generation time scales with `max_tokens`. Sending 1200 to a "write 3 sentences" task wastes time even when the response is short.

**Fix:** Per-call limits matched to the task:
- Data search: 1200 tokens (needs room for full JSON)
- Narrative recap: 400 tokens
- Stat explanation: 400 tokens
- YouTube ID: 200 tokens

**Carries over to backend?** Yes.

## 7. Hourly session cache via `window.storage`

**Problem:** Reopening the app within the same hour re-runs all 4 API calls for no reason — the underlying data hasn't changed.

**Fix:** Cache the full result in `window.storage` keyed by `report:YYYY-MM-DDTHH`. Same-hour reloads bypass the API entirely.

**Code:** Beginning of `loadReport()`:

```js
const cacheKey = `report:${new Date().toISOString().slice(0, 13)}`;
const cached = await window.storage?.get(cacheKey);
if (cached?.value) {
  // hydrate state from cache, return early
}
```

**Carries over to backend?** **No — the backend supersedes this.** Server-side caching with a real cache (Redis or in-memory + disk) replaces this. Cache the report once when the daily cron runs and serve it from cache for every user that day.

## Optimizations that didn't make it (and why)

These were considered but not applied:

- **Skip the YouTube search entirely** — would have been a fast win, but losing the embedded player would be a noticeable downgrade for the user. Worth keeping the call.
- **MLB Stats API migration** — the biggest possible win, but requires a backend. That's the Claude Code phase.

## Summary table

| # | Optimization | Carries to backend? | Notes |
|---|---|---|---|
| 1 | Parallel batching | ✓ | Same pattern, even for backend-side calls |
| 2 | Progressive rendering | ~ | Less critical with pre-generated reports |
| 3 | Model routing (Haiku/Sonnet) | ✓ | Critical for production cost |
| 4 | Cached system prompt | ✓ | Even more impactful for high-volume jobs |
| 5 | Web search `max_uses` | ✗ | Obsolete once MLB Stats API replaces search |
| 6 | Tighter `max_tokens` | ✓ | Always applies |
| 7 | Hourly session cache | ✗ | Backend cache replaces this |
