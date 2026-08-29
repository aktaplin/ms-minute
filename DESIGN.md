# Design System — The M's Minute

## Concept

Broadsheet newspaper aesthetic in each edition's team colors. The visual goal is
"Sunday sports section" — serif headlines, flagged sections, structured layouts,
cream paper. It should feel curated and editorial, not like an app. It gets there
on type and space: the page spends one rule where a section opens and almost
nowhere else (see "Rules", below).

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
| Paper 2 | `PAPER2` | `#EDE7D8` | Skeleton loaders, pitch-usage bar track, On This Day fill |
| Navy | `t.navy` | `#0C2340` | Headlines, section rules, button outlines, Stat of the Game fill |
| Teal | `t.teal` | `#005C5C` | Small-caps labels, focus ring, the wild card cut line |
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

### Rules: one weight, one ink, and only where a line means something

Every rule on the page is a 1px hairline in the edition's own navy at a single
alpha — `RULE` (0.55) via `ink(hex, alpha)`. There is no second or third step,
because a hierarchy built on alphas the eye cannot rank is not a hierarchy; it
is just more ink.

The page used to carry more than fifty rules: a hairline between every standings
row, every batter, every pitch, a box around each of twelve stat chips, a divider
above every aside. Each was defensible on its own and the sum read as a form.
Structure is the job of type and space — size, weight, case, tracking, and the
room around a block — and a rule is spent only where nothing else can do the
work:

| Where | What it is |
|---|---|
| Masthead and footer | The frame of the paper |
| Section flags, well and rail (`SectionHead`) | The one line that opens a section |
| Edition button, Refresh button | Affordances — this is a control |
| Error box | A state, and a rare one |
| Wild card cut line (teal) | A **report**, not a boundary: the playoff line itself |
| Active standings tab (2px) | A state, not a boundary |

Everything else is separated by space. Tables run on leading and alignment — 9px
row padding and tabular figures, the way a paper sets a standings block. Batters
are held apart by 26px, pitch rows by 18px, in-card asides by 18–20px: the gap
between blocks is several times the gap inside one, so proximity does the
grouping a hairline used to.

**No vertical rules, and none of the old boxes.** Every column break — the well
from the rail, the two newspaper columns inside a block, the innings from the
R/H/E totals, the score from the matchup — is held by a gutter. On This Day keeps
its PAPER2 fill but loses its outline (the fill already ends where the clipping
ends); the YouTube player loses its frame (a 16:9 black rectangle is its own
edge); the stat chips lose their boxes (see At the Plate).

### Section flags: same rule, different type

`SectionHead` renders every section flag, because a front page that gives every
item identical billing is a list, not a front page:

- **Main well** (default): hairline at `RULE`, 15px Fraunces label, 14px below.
- **Rail** (`rail`): the same hairline at the same ink, 12px label tracked wider
  at 0.18em, 11px below.

Every section is flagged and every flag is ruled. The rail briefly ran unruled —
type alone was meant to rank it below the well — and it does not hold up: a rail
section is a table, a dispatch, a market quote and a clipping stacked in a 340px
column, and 40px of air between them does not say where one ends and the next
begins when the content inside them is also separated by air. Rank is carried by
the label instead: 15px against 12px.

Both flags take the same 40px top margin and set their labels on the same line,
so where the two columns open, the rail's rule registers against the well's —
the alignment that lets the gutter between them go unruled.

**The score block has no flag at all.** It is the front page; labelling it "Last
Game" told the reader something they could already see, and cost the page its
top-of-page. The headline runs straight into the score.

### The desktop header band

On desktop the lede and the score card run the full page width; the main well and
the rail open below them, so the columns start together at Recap / Standings. The
score card takes a `wide` variant there, splitting its meta in three — score,
matchup, starter.

**The panels are sized to what they hold, not to percentages of the band.** A
column set at 30% under a 130px numeral opens a 200px hole beside the score, and
a second one beside the venue; the band then reads as three boxes floating in
white space rather than one line of type. So each panel takes `flex: 0 0 auto`
and `justify-content: space-between` collects the slack into two even gutters:
the score holds the left margin, the starter closes the band against the right,
and the matchup sits between them.

Two things keep the band short and its bottom even:

- **The result tag rides beside the score**, not under it. Stacked, it hung 40px
  below every other panel and left the band ragged along the bottom; beside the
  numeral it fills the left panel's width and reads the way a scoreboard does —
  `9–2  WIN` across, not down.
- **Venue and date set on one line**, split by a middot. Stacked they made a
  narrow three-line column in the middle of a 1,080px band, which is what the
  hole beside it was made of. The phone keeps them stacked: at a 390px measure
  one line would only wrap.

The phone's score panel is sized to its content for the same reason — at 42% of
the width it held a 100px numeral and pushed the starter line into a second
line.

The band carries no closing rule. The Recap and Standings flags sit at the same
height directly beneath it and read as one broken line across the page, which is
the boundary; a rule above them would be a second one saying the same thing.

### Cards

No rounded corners, no drop shadows. Sections are delineated by their flag and by
whitespace, not by boxes. What is left is two fills and one outline:

- Stat of the Game (full navy fill)
- On This Day (PAPER2 fill — an archival clipping; no outline, the fill is the edge)
- Error states (1px red border — a state, and a rare one)

Outlines that have been retired: the stat chips (now typographic pairs), the
YouTube player (a black 16:9 rectangle is its own edge), and On This Day's. The
two buttons keep a line because a line is what says "control".

### The 3px accent bar — retired

`border-left: 3px solid` marked an aside — the league-context callout inside Stat of
the Game, the last one standing. It was also the last vertical rule on the page, and
the callout was never relying on it: light-teal italic on the navy fill already reads
as an aside. Use type, not a bar.

### Score block

Big serif score and win/loss tag at the left, opponent, venue, date and starter at
the right, split by a gutter. The starter line is set off by space and its teal
small-caps label, not a rule. On mobile the **line score** sits 26px beneath the
card; on desktop it leaves the card entirely (see below).

### Line score

On desktop it is a section of its own in the main well, flagged `LINE SCORE` and
set under the Recap: the prose says two in the first and four in the second, and
the grid beneath answers it. That keeps the header band to what a reader wants in
one second — what happened, and the final — and keeps the table at a readable
measure. Spread across the full 1,080px band the innings lost their row.

Innings across, R/H/E at the right behind a 26px gutter, no rule under the inning
heads — teal small-caps against navy figures is already two different things.
Away team on top, home below, always. Scoring innings set in navy bold; zeros recede to MUTED, so a
six-run first is visible at a glance instead of collapsing into the final. A half
inning the home side never needed to bat prints `x`. Horizontally scrollable so
extra innings don't break the page. Data comes free from the `linescore` hydration
already on the schedule call in `getLastGame`.

### At the Plate

Player rows: name + position left, up to three stat pairs right, one italic
annotation below. Blocks are separated by 26px of space, not by a rule, and carry
no top padding, so both newspaper columns start level with the section flag.

The stat pairs were stat *chips* — a 1px box around each figure. Twelve boxes on
a page of four batters was the densest ink in the paper, and a boxed numeral is
no easier to read than a bold one. Now the figure sets in 17px Inter bold navy
with tabular figures over its 10px teal small-caps label, and an 18px gutter holds
the pairs apart.

### Stat of the Game

Inverts the palette — navy fill, cream and light-teal text. Huge stat value, the
abbreviation and full name, an explanation, and a light-teal italic context aside.
In column flow the prose breaks across the gutter normally; only the aside sets
`break-inside: avoid`.

### Standings

Tabbed — Division / Wild Card, defaulting to Wild Card. The tab row carries no
rule under it, so the active tab's 2px navy underline is unmistakably a state and
not a boundary; the inactive tab is MUTED. Teal is *not* used for the
inactive state: teal means "label" everywhere else, and spending it on the
unselected tab said the opposite of what it meant.

Wild card rows carry a `TrendGlyph`: direction in the arrow's shape (survives colour
loss), intensity in three redundant channels (arrowhead size, ink depth, doubled
head at ±3), with the L10 record and a compact streak token (`W5` / `L5`) rendered
as visible text — never in a `title` tooltip, which never opens on touch.

Neither table is ruled: no head rule, no row hairlines, just 9px of row padding
and tabular figures. That leaves the teal **cut line** as the only line in the
block, which is the point — it is the one horizontal on the page that reports
something rather than divides something, and it now reads that way.

### Next Game

Opens like a dispatch: a teal small-caps **dateline** (day · first pitch), then the
matchup in Fraunces 22, then opponent and venue, then the probable pitcher after a
14px gap, opened by its own teal `PROBABLE` label. The dateline is what marks the
card as ahead in time — no accent bar.

### WS Odds

A market quote: the percentage as a 32px Fraunces hero, a full-width sparkline
beneath it, then the window and the change in percentage points (green rising, red
falling) on one line 8px below, with the median line and book count as a footnote.
Nothing is ruled here: a hairline directly under a sparkline is two lines saying
different things in the same weight.

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
