'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const mlb = require('./mlb');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5';

// Cached system prompt — placed first so all three Claude calls share the same prefix
const SYS_VOICE = `You write for The M's Minute, a daily Seattle Mariners briefing for fans.

Voice: Factual, warm, and precise. Like a knowledgeable friend who watched the game and can tell you exactly what happened and why it matters. Grounded in what actually occurred — not in sentiment about it.

Rules:
- Plain English only. No jargon without a brief explanation.
- Short, punchy sentences.
- No sentimental or glib language. Avoid phrases like "that's why we believe", "the boys", "this team has heart", or any collective fan-identity framing.
- No filler phrases like "It was a great game" or "The team played well."
- Let the facts carry the emotion — a walk-off HR speaks for itself.
- When asked for JSON, return only valid JSON with no markdown fences or extra text.`;

// Stat curriculum: the pool Claude picks from each day, ordered basic → advanced.
// Claude selects whichever stat is most interestingly illustrated by that game.
const STAT_CURRICULUM = `
BASIC
- BA  (Batting Average): hits / at-bats
- OBP (On-Base Percentage): how often a batter reaches base
- SLG (Slugging Percentage): total bases per at-bat
- OPS (On-Base Plus Slugging): OBP + SLG combined
- ERA (Earned Run Average): earned runs allowed per 9 innings
- WHIP (Walks + Hits per Inning Pitched)
- K   (Strikeout): batter or pitcher perspective
- BB  (Walk / Base on Balls)
- HR  (Home Run)
- RBI (Runs Batted In)

INTERMEDIATE
- ISO (Isolated Power): SLG minus BA — measures raw power, not singles
- BABIP (Batting Average on Balls in Play): excludes HRs and strikeouts; reveals luck vs. skill
- K%  (Strikeout Rate): strikeouts per plate appearance
- BB% (Walk Rate): walks per plate appearance
- K/9 (Strikeouts per 9 Innings): pitcher strikeout rate normalized to a full game
- BB/9 (Walks per 9 Innings)
- HR/9 (Home Runs per 9 Innings)
- FIP (Fielding Independent Pitching): ERA-like but only counts K, BB, HR — removes defense
- LOB% (Left on Base %): how often a pitcher strands baserunners

ADVANCED
- wOBA (Weighted On-Base Average): weights each way of reaching base by its actual run value
- wRC+ (Weighted Runs Created Plus): offensive value relative to league average, park-adjusted; 100 = average
- xFIP (Expected FIP): like FIP but normalizes HR rate to league average
- WAR  (Wins Above Replacement): total value over a replacement-level player, in wins
- SIERA (Skill-Interactive ERA): ERA estimator using batted-ball types
- GB%/FB%/LD% (Ground Ball, Fly Ball, Line Drive rates)
- Hard%/Soft% (contact quality by exit velocity)
- Pull%/Oppo% (spray tendencies — pull-heavy or opposite-field)
`.trim();

async function _callClaude(userPrompt, maxTokens = 400) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: SYS_VOICE,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });
  return response.content[0].text.trim();
}

function _formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

async function _fetchYouTubeVideoId(lastGame) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    console.warn('[generate] YOUTUBE_API_KEY not set — skipping video lookup');
    return null;
  }
  try {
    const q = encodeURIComponent(`Seattle Mariners ${lastGame.opponentName} highlights`);
    const url =
      `https://www.googleapis.com/youtube/v3/search` +
      `?part=snippet&channelId=UCqzDdCzAprzCNhNUtM8omcQ` +
      `&q=${q}&order=date&maxResults=1&type=video&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API ${res.status}`);
    const data = await res.json();
    return data.items?.[0]?.id?.videoId ?? null;
  } catch (err) {
    console.error('[generate] YouTube lookup failed:', err.message);
    return null;
  }
}

async function generateDailyReport() {
  console.log('[generate] Fetching game data...');
  const lastGame = await mlb.getLastGame();
  const [boxScore, nextGame, standings] = await Promise.all([
    mlb.getBoxScore(lastGame.gamePk),
    mlb.getNextGame(),
    mlb.getStandings(),
  ]);

  // Build context strings for Claude prompts
  const result = lastGame.win
    ? `won ${lastGame.marinersScore}–${lastGame.opponentScore}`
    : `lost ${lastGame.marinersScore}–${lastGame.opponentScore}`;

  const batterLines = boxScore.offense
    .map(b =>
      `${b.name} (${b.position}): ${b.hits}/${b.atBats}, ${b.homeRuns} HR, ${b.rbi} RBI, ${b.runs} R` +
      ` | season: avg ${b.avg}, OBP ${b.obp}, SLG ${b.slg}, OPS ${b.ops}`
    )
    .join('\n');

  const sp = boxScore.startingPitcher;
  const spLine = sp
    ? `${sp.name}: ${sp.inningsPitched} IP, ${sp.strikeOuts} K, ${sp.earnedRuns} ER, ${sp.hits} H, ${sp.walks} BB` +
      ` | season: ERA ${sp.seasonEra}, WHIP ${sp.seasonWhip}, K/9 ${sp.seasonK9}`
    : 'Starter info unavailable';

  const narrativePrompt =
    `Write a 3-sentence recap of yesterday's Mariners game.\n\n` +
    `Game: Seattle Mariners ${result} against the ${lastGame.opponentName} at ${lastGame.venue} on ${_formatDate(lastGame.date)}.\n\n` +
    `Hitters:\n${batterLines}\n\n` +
    `Starting pitcher: ${spLine}\n\n` +
    `Wrap every player name in <em> tags. Return only the 3 sentences. No intro, no outro.`;

  const playerNotesPrompt =
    `Write a one-line journalist note for each of these Mariners players from yesterday's game.\n\n` +
    `${batterLines}\n` +
    (sp ? `\nStarting pitcher — ${spLine}` : '') +
    `\n\nEach note: one punchy sentence, starts with the player's name.\n` +
    `Return only valid JSON: [{"name": "...", "note": "..."}, ...]`;

  const statPrompt =
    `You are writing the "Stat of the Game" for a baseball newsletter. The reader is learning baseball — ` +
    `they know the basic box score (hits, runs, ERA) but not much beyond that. Your job is to teach them ` +
    `one stat per day, cycling through a curriculum from basic to advanced.\n\n` +
    `TODAY'S GAME\n` +
    `${lastGame.opponentName} at ${lastGame.venue} — Mariners ${result}\n` +
    `Hitters:\n${batterLines}\n` +
    `Starting pitcher: ${spLine}\n\n` +
    `STAT CURRICULUM (pick the one most interesting or well-illustrated by today's game):\n` +
    `${STAT_CURRICULUM}\n\n` +
    `Instructions:\n` +
    `- Pick ONE stat from the curriculum that today's game illustrates particularly well.\n` +
    `- Prefer variety over time — don't always pick HR or ERA. Lean toward intermediate/advanced stats when the game data supports it.\n` +
    `- If the stat's exact value is calculable from the data above, use it. If not (e.g. WAR, wRC+), you may use an approximate or contextual value, or set value to null.\n` +
    `- The explanation must: (1) define the stat in plain English, (2) give league-average context and what separates average from elite, (3) ground it in today's specific game data.\n\n` +
    `Return only valid JSON:\n` +
    `{"statName": "Full stat name", "abbr": "Abbreviation", "player": "Player name or null", "value": "Numeric value as a string, or null", "explanation": "3–4 sentences. Factual and educational."}`;

  console.log('[generate] Running Claude + YouTube in parallel...');
  const [narrative, playerNotesRaw, statRaw, ytVideoId] = await Promise.all([
    _callClaude(narrativePrompt, 400),
    _callClaude(playerNotesPrompt, 600),
    _callClaude(statPrompt, 500),
    _fetchYouTubeVideoId(lastGame),
  ]);

  let playerNotes = [];
  try {
    const cleaned = playerNotesRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    playerNotes = JSON.parse(cleaned);
  } catch {
    console.warn('[generate] Failed to parse player notes JSON');
    playerNotes = boxScore.offense.map(b => ({ name: b.name, note: '' }));
  }

  let statOfGame = null;
  try {
    const cleaned = statRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const parsed = JSON.parse(cleaned);
    statOfGame = {
      statName: parsed.statName,
      abbr: parsed.abbr,
      player: parsed.player ?? null,
      value: parsed.value ?? null,
      explanation: parsed.explanation,
    };
  } catch {
    console.warn('[generate] Failed to parse stat JSON');
    statOfGame = { statName: null, abbr: null, player: null, value: null, explanation: statRaw };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    lastGame,
    boxScore,
    standings,
    nextGame,
    narrative,
    playerNotes,
    statOfGame,
    ytVideoId,
  };

  console.log('[generate] Report generated.');
  return report;
}

module.exports = { generateDailyReport };
