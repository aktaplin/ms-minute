# Design System — The M's Minute

## Concept

Broadsheet newspaper aesthetic with Mariners team colors. The visual goal is "Sunday sports section" — serif headlines, column rules, structured layouts, cream paper. It should feel curated and editorial, not like an app.

## Palette

All color pairs are WCAG AA verified.

| Name | Hex | Use |
|------|-----|-----|
| `PAPER` | `#F6F1E7` | Main background — aged newsprint cream |
| `PAPER2` | `#EDE7D8` | Subtle dividers, skeleton loaders |
| `NAVY` | `#0C2340` | Headlines, masthead rules, structural borders, Stat of the Game card background. Mariners primary navy. |
| `TEAL` | `#005C5C` | Section labels, kicker, accent rules. Mariners teal. |
| `INK` | `#1A1A1A` | Primary body copy |
| `INK2` | `#444444` | Secondary copy |
| `MUTED` | `#5C5347` | Captions, dates, table rank numbers |
| `LTEAL` | `#A8C8C8` | Labels and accents on NAVY backgrounds |
| `LGREY` | `#C8D4DC` | Body copy on NAVY backgrounds |
| `WIN_GREEN` | `#245C3B` | Win indicator (filled result tag). Team-independent, semantic. |
| `WIN_RED` | `#8B1A1A` | Loss indicator (filled result tag), error states. Team-independent, semantic. |

### Contrast verification

Verified pairs (all AA-passing):

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

| Role | Font | Weight | Size | Notes |
|------|------|--------|------|-------|
| Nameplate | Playfair Display | 900 | clamp(40px, 12vw, 64px) | Tight tracking |
| Section headlines | Playfair Display | 900 | 22px | Player names, "SEA vs. X" |
| Body copy | Georgia | 400 | 13–15px | Italic for narrative recaps |
| Section labels | system-ui | 700 | 9px | Uppercase, 0.2em letter-spacing, teal |
| Stat numbers | Playfair Display | 900 | 38–54px | Score, stat of the game value |
| Stat chip values | Georgia | 700 | 13–20px | Box score numbers |
| Stat chip labels | system-ui | 700 | 7–8px | Uppercase, teal |
| Captions / meta | Georgia | 400 italic | 10–11px | MUTED color |

## Layout patterns

### Section dividers

Every section uses one consistent pattern:

```jsx
<div style={{ marginTop: 28, marginBottom: 14 }}>
  <div style={{ height: 2, background: NAVY, marginBottom: 6 }} />
  <div style={{
    fontSize: 9, fontWeight: 700, letterSpacing: "0.2em",
    textTransform: "uppercase", color: TEAL
  }}>
    {label}
  </div>
</div>
```

One thick navy rule above, teal label below. No bottom rule. Consistent across every section.

### Cards

No rounded cards or drop shadows. Sections are delineated by rules and whitespace, not boxes. The only "boxed" elements are:
- Stat chips (1px navy border)
- The Stat of the Game card (full navy fill, contained padding)
- The YouTube player (1px navy border)
- Error states (1px red border)

### Score card

Two-column layout split with a vertical navy rule. Left column: big serif score, win/loss pill. Right column: opponent name in italic serif, venue/date metadata, starting pitcher line.

### At the Plate (offensive lineup)

A list of 3–4 player rows. Each row has player name + position on the left, a row of stat chips on the right (H/AB, HR, RBI, BB — max 3), and a one-sentence italic narrative below. Rows separated by 1px PAPER2 lines.

### Stat of the Game

Inverts the palette — navy background, cream and light-teal text. The stat value is huge (42px), accompanied by the abbreviation, the player it belongs to, an explanation paragraph, and a context callout with a teal vertical bar.

### Standings table

Plain HTML table. Mariners row gets a serif font and bold weight to stand out. Compact rows (~7px padding).

### Next game

Left navy bar, indented content. Smaller serif headline, italic opponent name, time and probable pitcher with teal labels.

## Voice rules embedded in design

- Italic Georgia is reserved for narrative voice — anywhere a human is "speaking" through the design.
- Uppercase teal labels are reserved for section navigation and meta.
- Numbers — scores, stats — always get serif treatment for editorial gravity.
