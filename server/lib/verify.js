'use strict';

// Fact-checker pass. Given a block of ground-truth facts and a generated
// passage, returns the statements in the passage that either contradict the
// facts or assert something the facts don't support. Used by generate.js to
// catch hallucinations before a report ships. Fails open: any checker error
// returns "no violations" so a broken checker never blocks the daily report.

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Overridable so the checker can be run on a stronger model than the writer
// (the writer is Haiku; a same-or-stronger checker is a one-env-var change).
const VERIFY_MODEL = process.env.VERIFY_MODEL || 'claude-haiku-4-5';

const FACT_CHECKER_SYS = `You are a meticulous baseball fact-checker for a daily team briefing.

You are given a GROUND TRUTH block — the ONLY facts known to be true — and a PASSAGE written by someone else. Find every statement in the passage that is not supported.

Flag a statement when EITHER:
- CONTRADICTION: it conflicts with the ground truth — a wrong number, the wrong order of events, the wrong outcome, or the wrong player.
- UNSUPPORTED: it asserts a fact the ground truth does not establish. This especially includes any comparison between players, any team-wide or league-wide superlative ("only", "best", "leads the team", "most consistent"), and any season or career claim — whenever the numbers that would prove it are not present in the ground truth.

Do NOT flag:
- Voice, tone, phrasing, or opinion.
- General teaching explanations of what a stat or pitch type means.
- Reasonable paraphrase of facts that ARE in the ground truth.
- Grounded within-game superlatives the data DOES prove (e.g. "his hardest-hit ball of the night" when that exit velocity is his highest in the ground truth).
- Any player named ANYWHERE in the ground truth, including opponents who appear only inside the scoring timeline (often in parentheses after an event). A name that is present in the ground truth is a supported fact — never flag it as the "wrong player" or "unsupported" just because it is not in the hitters list. The hitters list covers one team; the timeline covers both.
- Warm, vivid description of what actually happened (how a rally built, the tension of a close inning). Flag unsupported *facts*, not color or narrative energy.

Ignore any <em> or other HTML tags — judge only the words.

Return ONLY a JSON array. Each element:
{"quote": "<smallest exact substring of the passage that is wrong or unsupported>", "type": "contradiction" | "unsupported", "issue": "<short phrase: why>"}
If everything checks out, return [].`;

async function findViolations({ label, facts, passage }) {
  if (!passage || !passage.trim()) return [];

  const userPrompt =
    `SECTION: ${label}\n\n` +
    `GROUND TRUTH (the only true facts):\n${facts}\n\n` +
    `PASSAGE TO CHECK:\n${passage}\n\n` +
    `Return the JSON array of problems (or [] if none).`;

  let raw;
  try {
    const response = await client.messages.create({
      model: VERIFY_MODEL,
      max_tokens: 600,
      system: [
        { type: 'text', text: FACT_CHECKER_SYS, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });
    raw = response.content[0].text.trim();
  } catch (err) {
    console.error(`[verify] ${label} check failed (failing open):`, err.message);
    return [];
  }

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.filter(v => v && v.quote) : [];
  } catch {
    console.warn(`[verify] ${label}: could not parse checker output`);
    return [];
  }
}

module.exports = { findViolations, VERIFY_MODEL };
