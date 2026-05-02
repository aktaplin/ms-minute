'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const mlb = require('./mlb');
const db = require('./db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5';

function _sysVoice(brandTitle, teamName) {
  return `You write for ${brandTitle}, a daily ${teamName} briefing for fans.

Voice: Factual, warm, and precise. Like a knowledgeable friend who watched the game and can tell you exactly what happened and why it matters. Grounded in what actually occurred — not in sentiment about it.

Rules:
- Plain English only. No jargon without a brief explanation.
- Short, punchy sentences.
- No sentimental or glib language. Avoid phrases like "that's why we believe", "the boys", "this team has heart", or any collective fan-identity framing.
- No filler phrases like "It was a great game" or "The team played well."
- Let the facts carry the emotion — a walk-off HR speaks for itself.
- When asked for JSON, return only valid JSON with no markdown fences or extra text.`;
}

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

// Maps stat abbreviations to their field names in the boxScore data
const STAT_FIELD_MAP = {
  // Batting — season
  BA:   { source: 'batter', field: 'avg' },
  AVG:  { source: 'batter', field: 'avg' },
  OBP:  { source: 'batter', field: 'obp' },
  SLG:  { source: 'batter', field: 'slg' },
  OPS:  { source: 'batter', field: 'ops' },
  // Batting — game
  H:    { source: 'batter', field: 'hits' },
  HR:   { source: 'batter', field: 'homeRuns' },
  RBI:  { source: 'batter', field: 'rbi' },
  R:    { source: 'batter', field: 'runs' },
  AB:   { source: 'batter', field: 'atBats' },
  // Pitching — season
  ERA:  { source: 'pitcher', field: 'seasonEra' },
  WHIP: { source: 'pitcher', field: 'seasonWhip' },
  'K/9': { source: 'pitcher', field: 'seasonK9' },
  // Pitching — game
  IP:   { source: 'pitcher', field: 'inningsPitched' },
  K:    { source: 'pitcher', field: 'strikeOuts' },
  ER:   { source: 'pitcher', field: 'earnedRuns' },
  BB:   { source: 'pitcher', field: 'walks' },
};

// Replaces Claude's returned value with the verified API value when available
function _resolveStatValue(statOfGame, boxScore) {
  const { abbr, player } = statOfGame;
  if (!abbr || !player) return statOfGame;

  const mapping = STAT_FIELD_MAP[abbr.toUpperCase()] ?? STAT_FIELD_MAP[abbr];
  if (!mapping) return statOfGame;

  const nameLower = player.toLowerCase();
  let realValue = null;

  if (mapping.source === 'batter') {
    const batter = boxScore.offense.find(b => b.name.toLowerCase() === nameLower);
    if (batter != null) realValue = batter[mapping.field];
  } else {
    const sp = boxScore.startingPitcher;
    if (sp != null && sp.name.toLowerCase() === nameLower) realValue = sp[mapping.field];
  }

  // Reject API placeholders (e.g. '.---', '--') that mean "no data"
  if (realValue == null || realValue === '.---' || realValue === '--') return statOfGame;

  return { ...statOfGame, value: String(realValue) };
}

async function _callClaude(userPrompt, maxTokens, brandTitle, teamName) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: _sysVoice(brandTitle, teamName),
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

// Format YYYY-MM-DD as M/D/YY (MLB's title convention, e.g. "5/1/26")
function _slashDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${m}/${d}/${String(y).slice(-2)}`;
}

async function _fetchYouTubeVideoId(lastGame, teamName) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    console.warn('[generate] YOUTUBE_API_KEY not set — skipping video lookup');
    return null;
  }
  try {
    // Bound the publish window to the 48 hours starting at the game's PT date
    // so YouTube only ranks recap videos uploaded around the actual game.
    const startMs = Date.parse(`${lastGame.date}T00:00:00-07:00`);
    const publishedAfter  = new Date(startMs).toISOString();
    const publishedBefore = new Date(startMs + 48 * 60 * 60 * 1000).toISOString();

    const q = encodeURIComponent(
      `${teamName} ${lastGame.opponentName} recap ${_slashDate(lastGame.date)}`
    );
    const url =
      `https://www.googleapis.com/youtube/v3/search` +
      `?part=snippet&channelId=UCoLrcjPV5PbUrUyXq5mjc_A` +
      `&q=${q}&type=video&maxResults=3` +
      `&publishedAfter=${encodeURIComponent(publishedAfter)}` +
      `&publishedBefore=${encodeURIComponent(publishedBefore)}` +
      `&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API ${res.status}`);
    const data = await res.json();
    return data.items?.[0]?.id?.videoId ?? null;
  } catch (err) {
    console.error('[generate] YouTube lookup failed:', err.message);
    return null;
  }
}

async function generateDailyReport(teamConfig = mlb.TEAM_CONFIGS[mlb.DEFAULT_TEAM_KEY]) {
  const { id: teamId, name: teamName, abbr: teamAbbr, divisionId, leagueId, divisionName, brandTitle } = teamConfig;
  console.log(`[generate] Fetching game data for ${teamName}...`);
  const lastGame = await mlb.getLastGame(teamId);
  const [boxScore, nextGame, standings] = await Promise.all([
    mlb.getBoxScore(lastGame.gamePk, teamId),
    mlb.getNextGame(teamId),
    mlb.getStandings(divisionId, leagueId),
  ]);

  // Build context strings for Claude prompts
  const result = lastGame.win
    ? `won ${lastGame.teamScore}–${lastGame.opponentScore}`
    : `lost ${lastGame.teamScore}–${lastGame.opponentScore}`;
  const teamShort = teamName.split(' ').pop();

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
    `Write a 3-sentence recap of yesterday's ${teamShort} game.\n\n` +
    `Game: ${teamName} ${result} against the ${lastGame.opponentName} at ${lastGame.venue} on ${_formatDate(lastGame.date)}.\n\n` +
    `Hitters:\n${batterLines}\n\n` +
    `Starting pitcher: ${spLine}\n\n` +
    `Wrap every player name in <em> tags. Return only the 3 sentences. No intro, no outro.`;

  const playerNotesPrompt =
    `Write a one-line journalist note for each of these ${teamShort} players from yesterday's game.\n\n` +
    `${batterLines}\n` +
    (sp ? `\nStarting pitcher — ${spLine}` : '') +
    `\n\nEach note: one punchy sentence, starts with the player's name.\n` +
    `Return only valid JSON: [{"name": "...", "note": "..."}, ...]`;

  const teamKey = Object.entries(mlb.TEAM_CONFIGS).find(([, cfg]) => cfg.id === teamId)?.[0] ?? mlb.DEFAULT_TEAM_KEY;
  const recentAbbrs = db.getRecentStatAbbrs(teamKey);
  const recentExclusion = recentAbbrs.length > 0
    ? `- Do NOT pick any of these stats, which were used in recent reports: ${recentAbbrs.join(', ')}.\n`
    : '';

  const statPrompt =
    `You are writing the "Stat of the Game" for a baseball newsletter. The reader is learning baseball — ` +
    `they know the basic box score (hits, runs, ERA) but not much beyond that. Your job is to teach them ` +
    `one stat per day, cycling through a curriculum from basic to advanced.\n\n` +
    `TODAY'S GAME\n` +
    `${lastGame.opponentName} at ${lastGame.venue} — ${teamShort} ${result}\n` +
    `Hitters:\n${batterLines}\n` +
    `Starting pitcher: ${spLine}\n\n` +
    `STAT CURRICULUM (pick the one most interesting or well-illustrated by today's game):\n` +
    `${STAT_CURRICULUM}\n\n` +
    `Instructions:\n` +
    `- Pick ONE stat from the curriculum that today's game illustrates particularly well.\n` +
    `- Prefer variety over time — don't always pick HR or ERA. Lean toward intermediate/advanced stats when the game data supports it.\n` +
    recentExclusion +
    `- If the stat's exact value is calculable from the data above, use it. If not (e.g. WAR, wRC+), you may use an approximate or contextual value, or set value to null.\n\n` +
    `Return only valid JSON with these exact fields:\n` +
    `{\n` +
    `  "statName": "Full stat name (e.g. Runs Batted In)",\n` +
    `  "abbr": "Abbreviation (e.g. RBI)",\n` +
    `  "player": "Player name this stat applies to, or null for team-level stats",\n` +
    `  "value": "The specific numeric value as a short string (e.g. \\"3\\" or \\"0.71\\"), or null if not calculable",\n` +
    `  "leagueContext": "One sentence: what is average, and what separates average from elite. Include real numbers (e.g. \\"League average OPS is around .720; anything above .900 is elite\\").",\n` +
    `  "definition": "1–2 sentences: what this stat measures in plain English, including what the abbreviation stands for.",\n` +
    `  "todayContext": "1–2 sentences: how today\\'s specific game data illustrates this stat. Be precise — reference the actual numbers."\n` +
    `}`;

  console.log('[generate] Running Claude + YouTube in parallel...');
  const [narrative, playerNotesRaw, statRaw, ytVideoId] = await Promise.all([
    _callClaude(narrativePrompt, 400, brandTitle, teamName),
    _callClaude(playerNotesPrompt, 600, brandTitle, teamName),
    _callClaude(statPrompt, 600, brandTitle, teamName),
    _fetchYouTubeVideoId(lastGame, teamName),
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
      leagueContext: parsed.leagueContext ?? null,
      definition: parsed.definition ?? null,
      todayContext: parsed.todayContext ?? null,
    };
    statOfGame = _resolveStatValue(statOfGame, boxScore);
  } catch {
    console.warn('[generate] Failed to parse stat JSON');
    statOfGame = { statName: null, abbr: null, player: null, value: null, leagueContext: null, definition: statRaw, todayContext: null };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    teamId,
    teamName,
    teamAbbr,
    brandTitle,
    divisionName,
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
