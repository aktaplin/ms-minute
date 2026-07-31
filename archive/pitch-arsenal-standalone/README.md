# Pitch Arsenal — standalone card + teaching prose (archived July 2026)

Folded into the Pitching card (Section A) as a compact stats-only list. This
archive is what got cut in that move: the standalone Learn-zone card (with its
header, caption, and per-pitch teaching prose) and the Haiku call that wrote
that prose. The underlying computation — `mlb.getStarterArsenal` — is still
live; only the presentation and the prose layer were cut.

## What changed

**Before:** a separate "Pitch Arsenal" card in Section B ("Learn the Game"),
with a header (pitcher name + total pitch count), a caption explaining the
bar/tick convention, one block per pitch (name, velo, bar, %/season%/delta,
whiffs, *and a Haiku-written teaching sentence*), and a bottom insight blurb
about the game's biggest usage swing vs. season norm.

**After:** the pitch blocks (minus the teaching sentence, header, caption, and
insight blurb) render directly inside the Pitching card, right after the
starter paragraph — see `PitchingCard` in `MsMinute.jsx`. No separate Haiku
call for this feature anymore (one fewer prompt per report).

## How to restore the old standalone card + prose

1. **`server/lib/generate.js`** — see `generate.js.snippet`: add back
   `arsenalLines` + `arsenalPrompt`, add an `arsenalRaw` slot to the big
   `Promise.all`, and rebuild `pitchArsenal` by parsing `arsenalRaw` into
   `notesByCode`/`arsenalInsight` and merging onto `arsenal.pitches`. Put the
   result back on `report.pitchArsenal` (top-level, not nested under
   `report.pitching`) to match the old client shape.

2. **`client/src/components/MsMinute.jsx`** — see `MsMinute.jsx.snippet`:
   add back the standalone `PitchArsenalCard` component (header, caption,
   per-pitch note, insight box), add `pitchArsenal: report.pitchArsenal ?? null`
   in `loadReport()`, add `data.pitchArsenal` back into both Learn-zone `show`
   guards (mobile zones array + desktop guard), and render
   `<PitchArsenalCard data={data.pitchArsenal} t={t} />` in the mobile and
   desktop Learn sections in place of (or alongside) the compact rows now
   living in `PitchingCard`.

Everything else (the underlying `mlb.getStarterArsenal` fetch, the merged
game/season pitch stats) is unchanged and still lives in the current code —
this archive is only the presentation layer and the prose-writing Haiku call.
