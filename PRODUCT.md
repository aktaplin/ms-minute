# Product Spec — The M's Minute

## The user

A Seattle Mariners fan who wants to keep up with the team but finds it hard to follow daily. Wants the report to double as a way to learn baseball stats over time, since they only know the basics (ERA, BA, HR).

## When and how they want it

- **When:** Lunch break (around noon) — they catch up on yesterday's game while eating
- **Where:** Mobile phone (iOS, mostly Chrome)
- **Format:** A clean mobile-friendly page they can pull up quickly

## What matters most (ranked)

1. Game recap & highlights — what actually happened
2. Player spotlights / storylines — who's hot, who's struggling
3. Stats explained in plain English — learn the language of baseball
4. Standings & playoff picture — context

## Specific features

### Daily report (core)
- Last game result with score, opponent, venue
- 3-sentence narrative recap in fan-friendly voice
- 3–4 player offensive performances with one-line journalist-style notes
- Stat of the Game — pick a real stat from that game and explain it
- Embedded MLB YouTube highlight video
- AL West standings with Mariners highlighted
- Next game info with probable pitcher

### "Turn the game on" text (priority feature)
- Trigger: Mariners game in the 7th inning or later AND score within 2 runs
- Format: A short SMS like "M's are in a nail-biter — 5-4 going into the 8th. Turn it on."
- Requires: phone number, Twilio integration, a backend service watching live games

### Educational layer
- Stat of the Game is intentionally tied to a real moment from yesterday's game, not a generic stat-of-the-week. This creates context and makes it stick.
- Voice should always be plain English — no jargon without explanation, no "actually it's more complicated" caveats.

## Voice and tone

The newsletter is written by a friend who watched the game and is telling you about it over coffee. Warm, knowledgeable, vivid. Never corporate, never bro-y, never overly nerdy. Player names get emphasis. Endings should land emotionally — proud after a win, commiserating after a loss, hopeful for tomorrow.

## Visual direction

Broadsheet newspaper with Mariners colors. Cream paper background, navy structure (rules, headlines), Mariners teal as the accent color (kickers, callouts). Playfair Display for headlines, Georgia for body copy. WCAG AA compliant. See `DESIGN.md` for full details.

## Out of scope (for now)

- Live in-game updates / play-by-play
- Multi-team support — this is a Mariners app
- Historical archive / past editions
- Comments, social, or sharing features
- Account system beyond a phone number for SMS
- Customization of report content
