# Hitter Spotlight (archived July 2026)

Removed from the live app to save on API calls / compute (one extra live-feed
walk in `mlb.js` per report, plus one Haiku call). The feature itself worked
fine — this is a cost cut, not a quality problem. Everything needed to restore
it is below.

## What it did

Statcast batted-ball story for the team's most interesting hitter of the
game: found the batter with the most hard-hit (95+ mph) balls in play (walking
`allPlays` from the live feed, tiebreaking on max exit velo then most balls in
play), then had Haiku write 2-3 teaching sentences about exit velocity/launch
angle using only that hitter's measured batted balls. Rendered as a card in
Section B ("Learn the Game") next to Pitch Arsenal.

## How to restore

1. **`server/lib/mlb.js`** — add back `getHitterSpotlight` (see `mlb.js.snippet`
   below) and add `getHitterSpotlight` to the `module.exports` list.

2. **`server/lib/generate.js`** — three insertion points, see
   `generate.js.snippet`:
   - Fetch `spotlight` alongside `arsenal` in the `Promise.all` that builds
     the starter's arsenal (was right after `getBoxScore`/`getNextGame`/etc.).
   - Build `spotlightLines` + `spotlightPrompt`, and add
     `spotlightPrompt ? _callClaude(spotlightPrompt, 300, brandTitle, teamName) : Promise.resolve(null)`
     as a `spotlightRaw` slot in the big `Promise.all` alongside the game
     sections / stat / arsenal / storylines / YouTube calls.
   - Add `hitterSpotlight: spotlight ? { ...spotlight, story: (spotlightRaw ?? '').trim() || null } : null`
     to the `report` object.

3. **`client/src/components/MsMinute.jsx`** — see `MsMinute.jsx.snippet`:
   - Add back the `HitterSpotlightCard` component.
   - Add `hitterSpotlight: report.hitterSpotlight ?? null` to the `data` object
     built in `loadReport()`.
   - Add `data.hitterSpotlight` back into the "Learn" zone's `show` condition
     (mobile zones array) and the desktop `(data.pitchArsenal || data.statOfGame || ...)` guard.
   - Render `<HitterSpotlightCard data={data.hitterSpotlight} t={t} />` in both
     the mobile Learn section (after `PitchArsenalCard`) and the desktop Learn
     spread (put `PitchArsenalCard` + `HitterSpotlightCard` back in a
     `display: grid, gridTemplateColumns: '1fr 1fr'` two-across row, same as
     Pitch Arsenal's neighbor used to be).

4. Update `CLAUDE.md`'s Learn-zone features list to un-mark it as archived.

No other files reference this feature (double-checked with a repo-wide grep
for `spotlight`/`Spotlight` before archiving).
