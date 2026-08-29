# Design System — The M's Minute

## Concept

Broadsheet newspaper aesthetic in each edition's team colors. The visual goal is
"Sunday sports section" — serif headlines, column rules, structured layouts, cream
paper. It should feel curated and editorial, not like an app.

The frame is borrowed from newspapers; the *specifics* are borrowed from baseball.
Where a choice is free, spend it on something that comes from the sport — the line
score, the pitch-usage bar, the L10 trend glyph — rather than on more newspaper.

## Palette

Structural color is **per-edition**, not fixed. Each team config in
`TEAM_CONFIGS` (`server/lib/mlb.js`) supplies a `theme` of `{ navy, teal, lteal }`,
delivered to the client by `GET /api/teams` and threaded through every component as
the `t` prop. The Mariners values below are the reference pairing; other editions
substitute their own and were chosen to hold the same contrast relationships.

| Name | Token | Mariners hex | Use |
|------|-------|--------------|-----|
| Paper | `PAPER` | `#F6F1E7` | Main background — aged newsprint cream |
| Paper 2 | `PAPER2` | `#EDE7D8` | Hairline dividers, skeleton loaders, On This Day fill |
| Navy | `t.navy` | `#0C2340` | Headlines, section rules, structural borders, Stat of the Game fill |
| Teal | `t.teal` | `#005C5C` | Small-caps labels, focus ring, accent rules |
| Light teal | `t.lteal` | `#A8C8C8` | Labels and asides on navy backgrounds |
| Ink | `INK` | `#1A1A1A` | Primary body copy |
| Ink 2 | `INK2` | `#444444` | Secondary copy |
| Muted | `MUTED` | `#5C5347` | Captions, dates, rank numbers, inactive tabs, zero cells |
| Light grey | `LGREY` | `#C8D4DC` | Body copy on navy backgrounds |
| Win green | `WIN_GREEN` | `#245C3B` | Win tag, rising odds. Team-independent, semantic. |
| Win red | `WIN_RED` | `#8B1A1A` | Loss tag, falling odds, error states. Team-independent, semantic. |

Trend arrows carry their own three-step ramps (`TREND_UP` / `TREND_DOWN` in
`MsMinute.jsx`), deliberately outside the team palette — form is a neutral fact.

### Contrast verification

Verified pairs for the Mariners theme (all AA-passing):

```
PAPER bg (#F6F1E7):
  INK   #1A1A1A  → 15.46:1  ✓
  INK2  #444444  →  8.65:1  ✓
  MUTED #5C5347  →  6.70:1  ✓
  TEAL  #005C5C  →  6.95:1  ✓
  NAVY  #0C2340  → 14.03:1  ✓
  RED   #8B1A1A  →  8.25:1  ✓

NAVY bg (#0C2340):
  PAPER #F6F1E7  → 14.03:1  ✓
  LTEAL #A8C8C8  →  8.84:1  ✓
  LGREY #C8D4DC  → 10.46:1  ✓

Result tags (cream PAPER text on filled color):
  WIN_GREEN bg #245C3B  → 6.98:1  ✓
  WIN_RED   bg #8B1A1A  → 8.25:1  ✓
```

## Typography

Two families, loaded in `client/index.html` (not via `@import`, so they fetch in
parallel with the bundle):

- **Fraunces** — variable serif, used at weight 900 for display. The `opsz` axis is
  driven explicitly: `OPSZ9` (`'opsz' 9`) for large display settings where the
  high-contrast cut belongs, `'opsz' 40` for the small-caps section labels.
- **Inter** — everything else: body copy, tables, labels, metadata.

Georgia and Playfair Display are **not** used; Georgia survives only as the fallback
in the Fraunces stack.

| Role | Face | Weight | Size | Notes |
|------|------|--------|------|-------|
| Nameplate | Fraunces | 900 | clamp(40px, 12vw, 64px) | `opsz` 9, −1px tracking |
| Daily headline (lede) | Fraunces | 900 | 40px desktop / clamp(26px, 7.5vw, 34px) mobile | `opsz` 9 |
| Section label | Fraunces | 900 | 15px well / 12px rail | Uppercase, `opsz` 40, 0.16em / 0.18em tracking |
| Card headline | Fraunces | 900 | 22px | On This Day, Next Game matchup |
| Score | Fraunces | 900 | 54px | `opsz` 9 |
| Line score totals (R) | Fraunces | 900 | 15px | Tabular; H/E fall back to Inter |
| Body copy | Inter | 400 | 17px | Justified with `hyphens: auto` in column flow |
| Player note / league context | Inter | 400 italic | 14px | The only italic on the page — see below |
| Small-caps label | Inter | 700 | 10–12px | Uppercase, 0.1–0.16em tracking, teal |
| Table data | Inter | 400–700 | 13–15px | `font-variant-numeric: tabular-nums` |

### The italic rule

**Italic marks annotation. Roman marks the record.**

Italic is reserved for prose that sits *beside* data and explains it: the one-line
player notes in At the Plate, and the league-context aside in Stat of the Game.
That is all — two uses.

Everything else is roman, including the Recap. The recap is not an annotation; it is
the report, and 17px justified two-column italic would be a worse reading experience
than the problem it solved. Metadata — dates, venues, captions, opponent names, the
footer — carries no italic at all. It previously carried it on fourteen elements,
which is how italic stopped meaning anything.

## Layout patterns

### Rules: one weight, three inks, horizontal only

Every rule on the page is a 1px hairline. What changes is the ink — the edition's
own navy, dialled back by `ink(hex, alpha)` so a rule separates the type on either
side of it without competing with either:

| Token | Alpha | Used for |
|---|---|---|
| `RULE` | 0.55 | The frame of the page: masthead, section flags, footer, table heads, box outlines |
| `RULE_SOFT` | 0.30 | Rail section flags, so the sidebar stays subordinate |
| `HAIR` | 0.14 | Hairlines inside a table or card: data rows, in-card separators |

**No vertical rules.** Every column break — the well from the rail, the two
newspaper columns inside a block, the innings from the R/H/E totals, the score from
the matchup — is held by a gutter instead. A gutter does the same work without
adding ink, and a page with a rule at every boundary reads as a form, not a paper.
Boxes (On This Day, the YouTube frame) keep their outline; a frame is an object,
not a boundary, and it is set at `RULE` like everything else.

The one 2px line left is the active standings tab's underline, which marks a state
rather than a boundary.

### Section flags, in two inks

`SectionHead` renders every section flag, because a front page that gives every
item identical billing is a list, not a front page:

- **Main well** (default): hairline at `RULE`, 15px Fraunces label, 14px below.
- **Rail** (`rail`): hairline at `RULE_SOFT`, 12px label, 10px below. The sidebar
  reads as subordinate to the front page instead of competing with it.

Both take the same 40px top margin, so where the two columns open the rail's first
rule registers against the well's — the alignment that lets the gutter between them
go unruled.

**The score block has no flag at all.** It is the front page; labelling it "Last
Game" told the reader something they could already see, and cost the page its
top-of-page. The headline runs straight into the score.

### The desktop header band

On desktop the lede and the score card run the full page width; the main well and
the rail open below them, so the columns start together at Recap / Standings. The
score card takes a `wide` variant there: at 1,080px two panels would strand white
space beside four short lines, so the meta splits in three — score, matchup,
starter — held apart by 56px gutters.

The band carries no closing rule. The Recap and Standings flags sit at the same
height directly beneath it and read as one broken line across the page, which is
the boundary; a rule above them would be a second one saying the same thing.

### Cards

No rounded corners, no drop shadows. Sections are delineated by rules and
whitespace, not boxes. The only boxed elements:

- Stat chips (`RULE` border)
- Stat of the Game (full navy fill)
- On This Day (PAPER2 fill, `RULE` border — an archival clipping)
- The YouTube player (`RULE` border)
- Error states (1px red border)

### The 3px accent bar — retired

`border-left: 3px solid` marked an aside — the league-context callout inside Stat of
the Game, the last one standing. It was also the last vertical rule on the page, and
the callout was never relying on it: light-teal italic on the navy fill already reads
as an aside. Use type, not a bar.

### Score block

Big serif score and win/loss tag at the left, opponent, venue, date and starter at
the right, split by a gutter. On mobile the **line score** sits beneath it under a
`RULE` hairline; on desktop it leaves the card entirely (see below).

### Line score

On desktop it is a section of its own in the main well, flagged `LINE SCORE` and
set under the Recap: the prose says two in the first and four in the second, and
the grid beneath answers it. That keeps the header band to what a reader wants in
one second — what happened, and the final — and keeps the table at a readable
measure. Spread across the full 1,080px band the innings lost their row.

Innings across, R/H/E at the right behind a 26px gutter. Away team on top,
home below, always. Scoring innings set in navy bold; zeros recede to MUTED, so a
six-run first is visible at a glance instead of collapsing into the final. A half
inning the home side never needed to bat prints `x`. Horizontally scrollable so
extra innings don't break the page. Data comes free from the `linescore` hydration
already on the schedule call in `getLastGame`.

### At the Plate

Player rows: name + position left, up to three stat chips right, one italic
annotation below. Separated by `HAIR` hairlines. No top padding on any row, so both
newspaper columns start level with the section flag.

### Stat of the Game

Inverts the palette — navy fill, cream and light-teal text. Huge stat value, the
abbreviation and full name, an explanation, and a light-teal italic context aside.
In column flow the prose breaks across the gutter normally; only the aside sets
`break-inside: avoid`.

### Standings

Tabbed — Division / Wild Card, defaulting to Wild Card. The active tab is navy with
a 2px navy underline; the inactive tab is MUTED. Teal is *not* used for the
inactive state: teal means "label" everywhere else, and spending it on the
unselected tab said the opposite of what it meant.

Wild card rows carry a `TrendGlyph`: direction in the arrow's shape (survives colour
loss), intensity in three redundant channels (arrowhead size, ink depth, doubled
head at ±3), with the L10 record and a compact streak token (`W5` / `L5`) rendered
as visible text — never in a `title` tooltip, which never opens on touch.

### Next Game

Opens like a dispatch: a teal small-caps **dateline** (day · first pitch), then the
matchup in Fraunces 22, then opponent and venue, then the probable pitcher behind a
hairline. The dateline is what marks it as ahead in time — no accent bar.

### WS Odds

A market quote: the percentage as a 32px Fraunces hero, a full-width sparkline
beneath it, then the window and the change in percentage points (green rising, red
falling) split across a hairline, with the median line and book count as a footnote.

## Motion and the quality floor

- `@keyframes pulse` drives the skeleton loaders. It is the only animation.
- A global `prefers-reduced-motion: reduce` block collapses all animation and
  transition durations. The loading state degrades to a static skeleton, which
  reads fine.
- `:focus-visible` renders a 2px teal outline at 2px offset on every interactive
  element. Do not remove it without replacing it.
- The edition picker is a real dialog: focus moves in on open, Tab is trapped,
  Escape closes, body scroll locks, and focus returns to the opener on close.
- Below 380px, the Next Game / WS Odds pair stacks to one column (`.pair-grid`).

## Voice rules embedded in design

- Italic is annotation. Roman is the record. (See the italic rule above.)
- Uppercase teal labels are for section flags, field labels, and datelines.
- Numbers that carry editorial weight — scores, the R column, the odds figure — get
  Fraunces. Numbers that are read in a table get Inter with tabular figures.
- `<em>` from the generator renders as **bold navy**, not italic, so model emphasis
  and the italic annotation rule never collide.
- Errors say what happened and what to do, in the paper's voice. The raw fetch
  message goes to the console and to a DEV-only line, never to the reader.
</content>
