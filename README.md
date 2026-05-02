# The M's Minute

A daily Seattle Mariners briefing — game recap, player highlights, plain-English stat explanations, and a "turn the game on" text alert when games get tight.

## What this package contains

- **`ms-minute-prototype.jsx`** — Working prototype built as a Claude.ai artifact. Single-file React component. Reads as the canonical UX reference.
- **`README.md`** — This file. Project overview and what to build first.
- **`PRODUCT.md`** — Original product spec, user research notes, and feature priorities.
- **`DESIGN.md`** — Visual system: palette, typography, component patterns, accessibility notes.
- **`ARCHITECTURE.md`** — How the prototype works today and what changes when you move to a real backend.
- **`OPTIMIZATIONS.md`** — Seven performance optimizations already applied to the prototype, with rationale.
- **`GAPS.md`** — What's missing and what to build next, in priority order.
- **`CLAUDE_CODE_PROMPTS.md`** — Suggested prompts for Claude Code to bootstrap each phase.

## The 30-second pitch

Mariners fans want a daily briefing that's both informative and educational. The M's Minute is a mobile-first daily report delivered around lunchtime that shows you what happened in the last game, who played well, and a stat from that game explained in plain English so you learn baseball as you read. A bonus text alert pings you when a live game gets close in the late innings so you can flip it on.

## Current state

A working single-file React prototype that runs as a Claude.ai artifact. It uses the Anthropic API with web search to gather game data and write narrative recaps, then renders a broadsheet-newspaper-styled mobile page. It works end-to-end but has real production gaps (see `GAPS.md`).

## What to build first in Claude Code

Read the docs in this order:
1. `PRODUCT.md` for context on what the app is for
2. `ARCHITECTURE.md` for how the prototype works and where it needs to evolve
3. `GAPS.md` for the prioritized list of what to build next
4. `CLAUDE_CODE_PROMPTS.md` for ready-to-paste prompts to start each phase

The single highest-value first move is **migrating the data layer from web-search-based scraping to the official MLB Stats API** (free, no key, much faster, infinitely cheaper). That alone unlocks scheduled jobs, the texting feature, and a real production deployment.

## Ways of working
* Always keep CLAUDE_CODE_PROMPTS.md up to date with what is done.
* Always keep Current State section in this document up to date.