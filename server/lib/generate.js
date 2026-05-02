'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const mlb = require('./mlb');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5';

// Cached system prompt — placed first so all three Claude calls share the same prefix
const SYS_VOICE = `You write for The M's Minute, a daily Seattle Mariners briefing for fans.

Voice: A knowledgeable friend who watched the game and is telling you about it over coffee. Warm, vivid, emotionally resonant. Never corporate, never bro-y, never overly nerdy. Player names get emphasis. After a win, be proud. After a loss, commiserate. Always leave the reader hopeful for tomorrow.

Rules:
- Plain English only. No jargon without a brief explanation.
- Short, punchy sentences.
- No filler phrases like "It was a great game" or "The team played well."
- When asked for JSON, return only valid JSON with no markdown fences or extra text.`;

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

// Detect the most interesting stat from the box score to explain
function _detectNotableStat(boxScore, lastGame) {
  const { offense, startingPitcher: sp } = boxScore;

  // Multi-HR game
  const multiHR = offense.find(b => b.homeRuns >= 2);
  if (multiHR) {
    return {
      label: `${multiHR.name}: ${multiHR.homeRuns} home runs`,
      context: `${multiHR.name} crushed ${multiHR.homeRuns} home runs, driving in ${multiHR.rbi} runs. He's batting ${multiHR.avg} on the season.`,
      player: multiHR.name,
      value: String(multiHR.homeRuns),
      abbr: 'HR',
    };
  }

  // 3+ RBI
  const bigRBI = offense.find(b => b.rbi >= 3);
  if (bigRBI) {
    return {
      label: `${bigRBI.name}: ${bigRBI.rbi} RBI`,
      context: `${bigRBI.name} drove in ${bigRBI.rbi} runs going ${bigRBI.hits}-for-${bigRBI.atBats}. He's batting ${bigRBI.avg} on the season.`,
      player: bigRBI.name,
      value: String(bigRBI.rbi),
      abbr: 'RBI',
    };
  }

  // SP WHIP under 1.00 (min 4 IP)
  if (sp) {
    const ip = parseFloat(sp.inningsPitched);
    if (ip >= 4 && (sp.walks + sp.hits) / ip < 1.0) {
      const whip = ((sp.walks + sp.hits) / ip).toFixed(2);
      return {
        label: `${sp.name}: ${whip} WHIP`,
        context: `${sp.name} allowed only ${sp.hits} hit${sp.hits !== 1 ? 's' : ''} and ${sp.walks} walk${sp.walks !== 1 ? 's' : ''} over ${sp.inningsPitched} innings (${sp.strikeOuts} strikeouts). His game WHIP was ${whip}.`,
        player: sp.name,
        value: whip,
        abbr: 'WHIP',
      };
    }
  }

  // 1-run win
  if (lastGame.win && lastGame.marinersScore - lastGame.opponentScore === 1) {
    return {
      label: `One-run win: ${lastGame.marinersScore}–${lastGame.opponentScore}`,
      context: `The Mariners squeaked out a one-run victory, ${lastGame.marinersScore}–${lastGame.opponentScore}, over the ${lastGame.opponentName}. One-run games are the closest thing baseball has to a coin flip.`,
      player: null,
      value: `${lastGame.marinersScore}–${lastGame.opponentScore}`,
      abbr: 'SCORE',
    };
  }

  // Fallback: top hitter
  const best = offense[0];
  return {
    label: `${best.name}: ${best.hits}-for-${best.atBats}`,
    context: `${best.name} led the offense going ${best.hits}-for-${best.atBats} with ${best.rbi} RBI, batting ${best.avg} on the season.`,
    player: best.name,
    value: `${best.hits}/${best.atBats}`,
    abbr: 'H/AB',
  };
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

  const detectedStat = _detectNotableStat(boxScore, lastGame);

  // Build context strings for Claude prompts
  const result = lastGame.win
    ? `won ${lastGame.marinersScore}–${lastGame.opponentScore}`
    : `lost ${lastGame.marinersScore}–${lastGame.opponentScore}`;

  const batterLines = boxScore.offense
    .map(b => `${b.name} (${b.position}): ${b.hits}-${b.atBats}, ${b.homeRuns} HR, ${b.rbi} RBI, ${b.runs} R, avg ${b.avg}`)
    .join('\n');

  const spLine = boxScore.startingPitcher
    ? `${boxScore.startingPitcher.name}: ${boxScore.startingPitcher.inningsPitched} IP, ${boxScore.startingPitcher.strikeOuts} K, ${boxScore.startingPitcher.earnedRuns} ER, ${boxScore.startingPitcher.hits} H, ${boxScore.startingPitcher.walks} BB`
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
    (boxScore.startingPitcher ? `\nStarting pitcher — ${spLine}` : '') +
    `\n\nEach note: one punchy sentence, starts with the player's name.\n` +
    `Return only valid JSON: [{"name": "...", "note": "..."}, ...]`;

  const statPrompt =
    `Explain this baseball stat to a casual fan who knows only the basics.\n\n` +
    `Stat: ${detectedStat.label}\n` +
    `Context: ${detectedStat.context}\n\n` +
    `Write 2–3 sentences. First: what this stat means. Second: why this performance was notable. Keep it warm and educational.\n` +
    `Return only the explanation.`;

  console.log('[generate] Running Claude + YouTube in parallel...');
  const [narrative, playerNotesRaw, statExplanation, ytVideoId] = await Promise.all([
    _callClaude(narrativePrompt, 400),
    _callClaude(playerNotesPrompt, 600),
    _callClaude(statPrompt, 300),
    _fetchYouTubeVideoId(lastGame),
  ]);

  let playerNotes = [];
  try {
    // Strip markdown fences if the model wrapped the JSON anyway
    const cleaned = playerNotesRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    playerNotes = JSON.parse(cleaned);
  } catch {
    console.warn('[generate] Failed to parse player notes JSON, extracting manually');
    playerNotes = boxScore.offense.map(b => ({ name: b.name, note: '' }));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    lastGame,
    boxScore,
    standings,
    nextGame,
    narrative,
    playerNotes,
    statOfGame: {
      label: detectedStat.label,
      player: detectedStat.player,
      value: detectedStat.value,
      abbr: detectedStat.abbr,
      explanation: statExplanation,
    },
    ytVideoId,
  };

  console.log('[generate] Report generated.');
  return report;
}

module.exports = { generateDailyReport };
