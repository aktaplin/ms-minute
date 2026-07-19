'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const mlb = require('./mlb');
const oddsApi = require('./oddsApi');
const db = require('./db');
const history = require('./history');
const storylines = require('./storylines');
const verify = require('./verify');
const { ptDateToday, stripJsonFences } = require('./util');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5';

function _sysVoice(brandTitle, teamName) {
  return `You write for ${brandTitle}, a daily ${teamName} briefing for fans.

Voice: Factual, warm, and precise. Like a knowledgeable friend who watched the game and can tell you exactly what happened and why it matters. The facts are the anchor; the warmth is in how you tell them.

Rules:
- Plain English only. No jargon without a brief explanation.
- Short, punchy sentences.
- No sentimental or glib language. Avoid phrases like "that's why we believe", "the boys", "this team has heart", or any collective fan-identity framing.
- No filler phrases like "It was a great game" or "The team played well."
- Let the facts carry the emotion — a walk-off HR speaks for itself. Describing what happened vividly is good; you don't have to write flat to write accurately.
- Ground every factual claim in the data you were given. Don't invent comparisons or superlatives across players, the league, or a player's own season/career (e.g. "only", "best", "leads the team", "most consistent", "career-high") unless the numbers that prove it are in this prompt. This bans unprovable claims, not warmth or color — vivid description of what actually happened in the game is always welcome.
- Always write the requested content. If a specific detail can't be supported by the data you were given, leave it out and write with what you have — never refuse, never ask the reader for information, never explain what you're missing or apologize.
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

// Maps RBI count on a single HR play to a type label
function _hrTypeLabel(rbi) {
  if (rbi === 1) return 'solo';
  if (rbi === 2) return '2-run';
  if (rbi === 3) return '3-run';
  if (rbi === 4) return 'grand slam';
  return `${rbi}-run`;
}

// Builds the HR portion of a batter line, annotated with type from play-by-play.
// Falls back to a bare count if the API data doesn't match the box score total.
function _hrAnnotation(batter, hrMap) {
  if (batter.homeRuns === 0) return '0 HR';
  const plays = hrMap[batter.name.toLowerCase()];
  if (!plays || plays.length !== batter.homeRuns) return `${batter.homeRuns} HR`;
  const labels = plays.map(_hrTypeLabel).join(', ');
  return `${batter.homeRuns} HR (${labels})`;
}

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

// Note: no cache_control here — these system prompts are far below Haiku 4.5's
// 4096-token minimum cacheable prefix, so a cache breakpoint would be a silent no-op.
async function _callClaude(userPrompt, maxTokens, brandTitle, teamName) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: _sysVoice(brandTitle, teamName),
    messages: [{ role: 'user', content: userPrompt }],
  });
  return response.content[0].text.trim();
}

// --- Fact-check + repair -------------------------------------------------
// Each verified section is generated, then checked against a ground-truth
// facts block. On any flagged claim we regenerate the section once (telling
// the writer exactly what to fix); if it still fails, we strip the offending
// sentence(s). Numbers and event order in the facts block are the only truth.

function _violationNote(violations) {
  const lines = violations
    .map(v => `- Remove or fix: "${v.quote}" (${v.issue ?? v.type ?? 'unsupported'})`)
    .join('\n');
  return (
    `IMPORTANT — a fact-check flagged the following in your previous attempt. ` +
    `Rewrite it in the SAME format and length so none of these appear. ` +
    `If a detail can't be supported by the data you were given, drop it and write around it. ` +
    `Do not mention this fact-check, do not apologize, do not ask for anything, do not address the reader — ` +
    `output only the rewritten content:\n${lines}`
  );
}

// A writer that runs out of grounded material sometimes returns meta-commentary
// or a refusal ("I cannot write this without...", "Could you provide...") instead
// of the requested content. That text asserts no false baseball facts, so the
// fact-checker passes it and it would otherwise ship as the section. Detect it
// so we can fall back instead. Real recaps are third-person prose and never trip
// these first-person / reader-directed patterns.
function _looksLikeRefusal(text) {
  const plain = (text ?? '').replace(/<[^>]+>/g, ' ').toLowerCase();
  if (!plain.trim()) return true;
  return [
    /\bi (cannot|can't|can not|am unable|'m unable|won't|will not|don't have|do not have|need more|need the)\b/,
    /\b(could|can|would) you (please )?(provide|confirm|share|give)\b/,
    /\bplease provide\b/,
    /\bonce i (have|receive|get)\b/,
    /\bi'?ll (deliver|provide|write|rewrite)\b/,
    /\bwithout (accurate|the correct|the actual|reliable)\b/,
    /\bas specified\b/,
  ].some(re => re.test(plain));
}

function _slimFlag(v) {
  return { quote: v.quote ?? null, type: v.type ?? null, issue: v.issue ?? null };
}

// Per-section audit record embedded in the report JSON. outcome is one of:
//   'fixed_on_regen'   — flagged, then a clean regeneration replaced it
//   'stripped'         — still flagged after regen, offending sentence(s) removed
//   'refusal_fallback' — the writer returned meta-commentary/refusal (or
//                        unparseable output), so the deterministic fallback shipped
function _record(section, outcome, initialFlags, residualFlags) {
  return {
    section,
    outcome,
    initialFlags: initialFlags.map(_slimFlag),
    residualFlags: residualFlags.map(_slimFlag),
  };
}

// Lowercased, tag-stripped quotes from a violation list, for containment checks
function _flaggedQuotes(violations) {
  return violations
    .map(v => (v.quote ?? '').replace(/<[^>]+>/g, '').toLowerCase().trim())
    .filter(Boolean);
}

function _containsFlagged(text, quotes) {
  const plain = (text ?? '').replace(/<[^>]+>/g, '').toLowerCase();
  return quotes.some(q => plain.includes(q));
}

// Drop any sentence containing a flagged quote (tags ignored in the compare).
function _stripSentences(text, quotes) {
  if (!text || quotes.length === 0) return text;
  const kept = text
    .split(/(?<=[.!?])\s+/)
    .filter(s => !_containsFlagged(s, quotes));
  return kept.join(' ').trim();
}

// Generate all four game sections (headline, recap, player notes, pitching) in
// ONE Claude call, then fact-check the combined prose in one verify call. The
// shared game context (batter lines, pitcher lines, timeline) is sent once
// instead of once per section. On flags: one regen, then per-section stripping.
// Returns { value: { headline, recap, playerNotes, pitching }, record }.
async function _generateVerifiedGameSections({ prompt, facts, fallbacks, brandTitle, teamName }) {
  const parse = (raw) => {
    try {
      const p = JSON.parse(stripJsonFences(raw));
      return {
        headline: typeof p.headline === 'string' ? p.headline : null,
        recap: typeof p.recap === 'string' ? p.recap : null,
        playerNotes: Array.isArray(p.playerNotes) ? p.playerNotes : null,
        pitching: {
          starter: p.pitching?.starter ?? null,
          bullpen: p.pitching?.bullpen ?? null,
        },
      };
    } catch {
      console.warn('[generate] Failed to parse game sections JSON');
      return null;
    }
  };
  const fallbackSections = {
    headline: fallbacks.headline,
    recap: fallbacks.narrative,
    playerNotes: fallbacks.notes,
    pitching: { starter: null, bullpen: null },
  };
  const usable = (s) => s !== null && !_looksLikeRefusal(s.recap ?? '');
  const passageOf = (s) => [
    s.headline,
    s.recap,
    s.pitching.starter,
    s.pitching.bullpen,
    ...(s.playerNotes ?? []).map(n => n?.note),
  ].filter(Boolean).join('\n');

  let sections = parse(await _callClaude(prompt, 1500, brandTitle, teamName));
  if (!usable(sections)) {
    console.warn('[generate] game sections: unusable output; retrying once.');
    sections = parse(await _callClaude(prompt, 1500, brandTitle, teamName));
  }
  if (!usable(sections)) {
    console.warn('[generate] game sections: unusable after retry; using fallbacks.');
    return { value: fallbackSections, record: _record('game', 'refusal_fallback', [], []) };
  }

  let violations = await verify.findViolations({ label: 'game', facts, passage: passageOf(sections) });
  if (violations.length === 0) return { value: sections, record: null };

  const initialFlags = violations;
  console.warn(`[generate] game sections: ${violations.length} issue(s) flagged; regenerating once.`);
  const regen = parse(await _callClaude(`${prompt}\n\n${_violationNote(violations)}`, 1500, brandTitle, teamName));
  if (usable(regen)) {
    violations = await verify.findViolations({ label: 'game', facts, passage: passageOf(regen) });
    if (violations.length === 0) {
      return { value: regen, record: _record('game', 'fixed_on_regen', initialFlags, []) };
    }
    sections = regen;
  }

  // Still flagged (or regen unusable): repair each section independently.
  console.warn(`[generate] game sections: still flagged after retry; stripping ${violations.length} claim(s).`);
  const quotes = _flaggedQuotes(violations);
  const repaired = {
    headline: _containsFlagged(sections.headline, quotes) ? fallbacks.headline : sections.headline,
    recap: _stripSentences(sections.recap, quotes) || fallbacks.narrative,
    playerNotes: (sections.playerNotes ?? []).map(n =>
      _containsFlagged(n?.note, quotes) ? { ...n, note: '' } : n
    ),
    pitching: {
      starter: sections.pitching.starter ? (_stripSentences(sections.pitching.starter, quotes) || null) : null,
      bullpen: sections.pitching.bullpen ? (_stripSentences(sections.pitching.bullpen, quotes) || null) : null,
    },
  };
  return { value: repaired, record: _record('game', 'stripped', initialFlags, violations) };
}

// Generate the season storyline sentences, verify them, repair as needed.
// candidates carry deterministic fallback text, so any failure degrades to the
// grounded template rather than dropping the thread. Returns { value, record }.
async function _generateVerifiedStorylines({ candidates, prompt, facts, brandTitle, teamName }) {
  const toThreads = (textByKind) => candidates.map((c, i) => ({
    kind: c.kind,
    label: c.label,
    metric: c.metric,
    value: c.value,
    text: textByKind[c.kind] ?? textByKind[`__idx${i}`] ?? c.fallbackText,
  }));
  const fallbackThreads = toThreads({});

  if (!prompt || candidates.length === 0) return { value: fallbackThreads, record: null };

  const parseTextByKind = (raw) => {
    const map = {};
    try {
      const arr = JSON.parse(stripJsonFences(raw));
      if (!Array.isArray(arr)) return map;
      arr.forEach((entry, i) => {
        if (!entry || typeof entry.text !== 'string') return;
        if (entry.kind) map[entry.kind] = entry.text;
        map[`__idx${i}`] = entry.text;
      });
    } catch {
      console.warn('[generate] Failed to parse storylines JSON');
    }
    return map;
  };
  const passageOf = (threads) => threads.map(t => t.text).filter(Boolean).join('\n');

  let raw = await _callClaude(prompt, 500, brandTitle, teamName);
  if (_looksLikeRefusal(raw)) {
    console.warn('[generate] storylines: writer returned meta/refusal; using fallback.');
    return { value: fallbackThreads, record: _record('storylines', 'refusal_fallback', [], []) };
  }
  let threads = toThreads(parseTextByKind(raw));
  let violations = await verify.findViolations({ label: 'storylines', facts, passage: passageOf(threads) });
  if (violations.length === 0) return { value: threads, record: null };

  const initialFlags = violations;
  console.warn(`[generate] storylines: ${violations.length} issue(s) flagged; regenerating once.`);
  raw = await _callClaude(`${prompt}\n\n${_violationNote(violations)}`, 500, brandTitle, teamName);
  if (!_looksLikeRefusal(raw)) {
    threads = toThreads(parseTextByKind(raw));
    violations = await verify.findViolations({ label: 'storylines', facts, passage: passageOf(threads) });
    if (violations.length === 0) {
      return { value: threads, record: _record('storylines', 'fixed_on_regen', initialFlags, []) };
    }
  }

  // Still flagged (or refused on regen): swap only the flagged threads back to
  // their deterministic fallback sentence; keep the clean ones as written.
  console.warn('[generate] storylines: still flagged after retry; reverting flagged threads to fallback.');
  const quotes = _flaggedQuotes(violations);
  const repaired = threads.map((t, i) =>
    _containsFlagged(t.text, quotes) ? { ...t, text: candidates[i].fallbackText } : t
  );
  return { value: repaired, record: _record('storylines', 'stripped', initialFlags, violations) };
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

function _formatScoringTimeline(scoringTimeline, teamShort, opponentName) {
  if (!scoringTimeline || scoringTimeline.length === 0) return null;
  return scoringTimeline.map(entry => {
    const scorer = entry.isTeam ? teamShort : opponentName;
    const events = entry.events
      .map(e => {
        const leader = e.teamScore > e.oppScore ? teamShort : e.teamScore < e.oppScore ? opponentName : 'tied';
        const scoreStr = `${e.teamScore}–${e.oppScore} ${leader}`;
        const desc = (e.rbi > 0 && e.batter) ? `${e.event} (${e.batter})` : e.event;
        return `${desc} [${scoreStr}]`;
      })
      .join(', ');
    const flag = entry.isLeadChange ? ' [lead change]' : '';
    return `  Inning ${entry.inning} (${scorer}): ${events}${flag}`;
  }).join('\n');
}

async function generateDailyReport(teamConfig = mlb.TEAM_CONFIGS[mlb.DEFAULT_TEAM_KEY]) {
  const { id: teamId, name: teamName, abbr: teamAbbr, divisionId, leagueId, divisionName, brandTitle } = teamConfig;
  console.log(`[generate] Fetching game data for ${teamName}...`);
  const lastGame = await mlb.getLastGame(teamId);
  const [boxScore, nextGame, standings, recentResults, allTitleOdds, { hrMap, scoringTimeline, pitcherOrder }] = await Promise.all([
    mlb.getBoxScore(lastGame.gamePk, teamId),
    mlb.getNextGame(teamId),
    mlb.getStandings(divisionId, leagueId),
    mlb.getRecentResults(teamId).catch(err => {
      console.warn('[generate] getRecentResults failed (storylines degrade):', err.message);
      return [];
    }),
    oddsApi.getWorldSeriesOdds(),
    mlb.getPlayByPlayData(lastGame.gamePk, teamId),
  ]);
  const titleOdds = allTitleOdds?.[teamName] ?? null;

  // Starter's pitch mix vs. season norms + Statcast batted-ball story, in
  // parallel (the live feed is already cached by getPlayByPlayData; this costs
  // one extra request for the season arsenal).
  const [arsenal, spotlight] = await Promise.all([
    mlb.getStarterArsenal(lastGame.gamePk, boxScore.startingPitcher?.id),
    mlb.getHitterSpotlight(lastGame.gamePk, teamId),
  ]);

  // Order relievers by actual first appearance (play-by-play), not the boxscore
  // array — this is what "who came in before whom" claims are checked against.
  boxScore.relievers = [...(boxScore.relievers ?? [])].sort(
    (a, b) => (pitcherOrder[a.id] ?? Number.MAX_SAFE_INTEGER) - (pitcherOrder[b.id] ?? Number.MAX_SAFE_INTEGER)
  );

  // Resolve team key for cache/history operations (used twice below)
  const teamKey = Object.entries(mlb.TEAM_CONFIGS).find(([, cfg]) => cfg.id === teamId)?.[0] ?? mlb.DEFAULT_TEAM_KEY;

  // Persist today's WS-winner number, then read the trailing window for the sparkline
  const todayPt = ptDateToday();
  if (titleOdds) {
    db.saveTitleOdds(teamKey, todayPt, titleOdds.impliedProb, titleOdds.medianOdds);
  }
  const titleOddsTrend = db.getTitleOddsTrend(teamKey, 30);

  // Snapshot today's division position, then read the trailing window so the
  // momentum storyline can measure how the race has moved since last week.
  const standingsRow = standings.find(r => r.teamId === teamId);
  if (standingsRow) {
    db.saveStandingsSnapshot(teamKey, todayPt, {
      gb: storylines.parseGb(standingsRow.gb),
      divisionRank: standingsRow.divisionRank,
      wins: standingsRow.wins,
      losses: standingsRow.losses,
    });
  }
  const standingsHistory = db.getStandingsHistory(teamKey, 28);

  // Season threads that carry game-to-game (streaks, form, division momentum).
  // Each candidate is fully grounded in the numbers and carries a deterministic
  // fallback sentence; Haiku only rewrites for voice, checked against factsBlock.
  const storylineCandidates = storylines.build({
    teamConfig, standings, recentResults, standingsHistory, todayIso: todayPt,
  });

  // Featured franchise moment for today's calendar date (null when none is curated)
  const onThisDay = history.getOnThisDay(teamKey, todayPt.slice(5));

  // Build context strings for Claude prompts
  const result = lastGame.win
    ? `won ${lastGame.teamScore}–${lastGame.opponentScore}`
    : `lost ${lastGame.teamScore}–${lastGame.opponentScore}`;
  const teamShort = teamName.split(' ').pop();

  const batterLines = boxScore.offense
    .map(b =>
      `${b.name} (${b.position}): ${b.hits}/${b.atBats}, ${_hrAnnotation(b, hrMap)}, ${b.rbi} RBI, ${b.runs} R` +
      ` | season: avg ${b.avg}, OBP ${b.obp}, SLG ${b.slg}, OPS ${b.ops}`
    )
    .join('\n');

  const sp = boxScore.startingPitcher;
  const spLine = sp
    ? `${sp.name}: ${sp.inningsPitched} IP, ${sp.strikeOuts} K, ${sp.earnedRuns} ER, ${sp.hits} H, ${sp.walks} BB` +
      ` | season: ERA ${sp.seasonEra}, WHIP ${sp.seasonWhip}, K/9 ${sp.seasonK9}`
    : 'Starter info unavailable';

  const reliefLines = (boxScore.relievers ?? [])
    .map((r, i) =>
      `${i + 1}. ${r.name}: ${r.inningsPitched} IP, ${r.strikeOuts} K, ${r.earnedRuns} ER, ${r.hits} H, ${r.walks} BB` +
      ` | season: ERA ${r.seasonEra}, WHIP ${r.seasonWhip}`
    )
    .join('\n');

  const timelineText = _formatScoringTimeline(scoringTimeline, teamShort, lastGame.opponentName);

  // One prompt generates all four game sections; the shared context (result,
  // timeline, batter/pitcher lines) is sent once instead of once per section.
  const gamePrompt =
    `Write four sections of yesterday's ${teamShort} game report.\n\n` +
    `GAME\n` +
    `Result: ${teamName} ${result} against the ${lastGame.opponentName} at ${lastGame.venue} on ${_formatDate(lastGame.date)}.\n` +
    (timelineText ? `Scoring timeline (chronological):\n${timelineText}\n` : '') +
    `Hitters (game line | season stats):\n${batterLines}\n` +
    `Starting pitcher: ${spLine}\n` +
    (reliefLines
      ? `Relief pitchers, numbered in their exact order of appearance (1 entered first):\n${reliefLines}\n`
      : `No relief pitchers — the starter went the distance.\n`) +
    `\nReturn only valid JSON with these exact fields:\n` +
    `{\n` +
    `  "headline": "...",\n` +
    `  "recap": "...",\n` +
    `  "playerNotes": [{"name": "...", "note": "..."}, ...],\n` +
    `  "pitching": {"starter": "...", "bullpen": ${reliefLines ? '"..."' : 'null'}}\n` +
    `}\n\n` +
    `HEADLINE rules:\n` +
    `- 5 to 9 words. No period, no exclamation mark.\n` +
    `- Factual and specific: name the decisive thing (a player, an inning, the margin).\n` +
    `- Sentence case, plain text only — no <em> tags, no quotes.\n\n` +
    `RECAP rules:\n` +
    `- Exactly 4 chronological sentences${timelineText ? ', using the scoring timeline as your backbone' : ''}: ` +
    `(1) how the game started or who scored first, (2) the key sequence or turning point, ` +
    `(3) how the lead was held or extended after that, (4) the final result with one grounding detail.\n` +
    `- Do not cover individual player stats in depth — those are handled elsewhere. ` +
    `Name players only when they drove a scoring moment.\n` +
    `- Wrap every player name in <em> tags.\n\n` +
    `PLAYERNOTES rules:\n` +
    `- One entry per hitter listed above: one punchy journalist sentence starting with the player's name.\n` +
    `- HR type labels (solo, 2-run, etc.) tell you exactly how many runs that home run scored — ` +
    `a player's total RBI may include other at-bats, so do not attribute all their RBI to the home run.\n\n` +
    `PITCHING rules:\n` +
    `- "starter": up to 3 sentences on the starting pitcher's outing. Reference the actual line — ` +
    `innings, strikeouts, runs, baserunners. Note the season context (ERA, WHIP) only if it sharpens the story.\n` +
    (reliefLines
      ? `- "bullpen": exactly 2 sentences summarizing the relief pitchers as a group. Mention specific names ` +
        `where it matters (the high-leverage outing, the rough one), but treat them collectively. If you say ` +
        `who pitched earlier or later, it MUST match the numbered order above — never reverse it.\n`
      : `- "bullpen": set to null.\n`) +
    `- Wrap every player name in <em> tags in the pitching prose.`;

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

  const arsenalLines = arsenal
    ? arsenal.pitches
        .map(p =>
          `${p.name} (${p.code}): ${p.count} thrown (${p.gamePct}% of pitches), ` +
          `avg ${p.avgVelo ?? '?'} mph, max ${p.maxVelo ?? '?'} mph, ${p.whiffs} swinging strikes` +
          (p.seasonPct != null
            ? ` | season usage ${p.seasonPct}% (${p.deltaPts >= 0 ? '+' : ''}${p.deltaPts} pts vs. season)`
            : ' | no season usage data')
        )
        .join('\n')
    : null;

  const arsenalPrompt = arsenal
    ? `You are writing the "Pitch Arsenal" section — teaching a reader who is learning baseball ` +
      `what each pitch type is, using the starter's actual outing.\n\n` +
      `Starter: ${sp.name} (${teamShort}), yesterday vs. the ${lastGame.opponentName}.\n` +
      `Line: ${spLine}\n\n` +
      `Pitches thrown (measured data from this game):\n${arsenalLines}\n\n` +
      `Return only valid JSON:\n` +
      `{\n` +
      `  "pitches": [{"code": "FF", "note": "..."}, ...],\n` +
      `  "insight": "..." or null\n` +
      `}\n` +
      `Rules:\n` +
      `- One entry per pitch listed above, using the same codes.\n` +
      `- Each note: ONE sentence in plain English — what this pitch type does (movement, purpose) ` +
      `woven with how it played in this game (whiffs, velocity).\n` +
      `- "insight": one sentence about the most notable difference between this game's usage and ` +
      `season usage, using the +/- pts provided. Set to null if season data is unavailable or no delta exceeds 5 pts.\n` +
      `- Use ONLY the numbers provided above. Do not invent velocities, counts, percentages, or outcomes.`
    : null;

  const spotlightLines = spotlight
    ? spotlight.ballsInPlay
        .map(b =>
          `${b.event ?? 'Ball in play'}: ${b.exitVelo} mph exit velocity` +
          (b.launchAngle != null ? `, ${b.launchAngle}° launch angle` : '') +
          (b.distance != null ? `, ${b.distance} ft` : '')
        )
        .join('\n')
    : null;

  const spotlightPrompt = spotlight
    ? `You are writing the "Hitter Spotlight" — teaching a reader who is learning baseball ` +
      `what exit velocity and launch angle mean, using one hitter's actual batted balls.\n\n` +
      `Hitter: ${spotlight.name} (${teamShort}), yesterday vs. the ${lastGame.opponentName}.\n` +
      `Batted balls (Statcast measurements from this game):\n${spotlightLines}\n\n` +
      `Context: 95+ mph exit velocity is a "hard-hit" ball. Line drives (roughly 10-25° launch angle) ` +
      `become hits most often; balls hit hard but very low become groundouts, very high become flyouts.\n\n` +
      `Write 2-3 sentences telling the story of this hitter's night through these measurements — ` +
      `teach what the numbers mean by what they produced. ` +
      `Use ONLY the measurements provided. Plain text, no <em> tags. Return only the sentences.`
    : null;

  // Season storylines: one in-voice sentence per grounded thread. The exact facts
  // are pre-computed; Haiku only rewrites them, and the deterministic sentence is
  // the guaranteed fallback on any refusal or fact-check miss.
  const storylinePrompt = storylineCandidates.length > 0
    ? `You are writing the "Storylines" strip for ${brandTitle} — short season-context threads that carry from game to game.\n\n` +
      `Each thread below has exact facts. Rewrite each as ONE sentence in the house voice — factual and warm, no hype.\n\n` +
      `Threads (keep this exact order):\n` +
      storylineCandidates.map((c, i) => `${i + 1}. [${c.label}] ${c.facts}`).join('\n') +
      `\n\nRules:\n` +
      `- Exactly one sentence per thread, in the same order.\n` +
      `- Use ONLY the numbers in that thread's facts. Do not invent comparisons, superlatives, records, or standings not shown.\n` +
      `- Plain text; wrap any player name in <em> tags (most threads are team-level with no player names).\n` +
      `- Return only valid JSON: [{"kind": "...", "text": "..."}, ...] using each thread's kind.`
    : null;

  // Single ground-truth block every fact-check runs against. Everything here
  // came straight from the MLB API — the checker treats it as the only truth.
  const factsBlock = [
    `Final: ${teamName} ${result} against the ${lastGame.opponentName} at ${lastGame.venue} on ${_formatDate(lastGame.date)}.`,
    timelineText ? `Scoring timeline (chronological):\n${timelineText}` : null,
    `Hitters who batted (game line | season stats):\n${batterLines}`,
    `Starting pitcher: ${spLine}`,
    reliefLines
      ? `Relievers, numbered in order of appearance (1 entered first):\n${reliefLines}`
      : `No relievers — the starter went the distance.`,
    storylineCandidates.length > 0
      ? `Season storylines (each is an established fact):\n${storylineCandidates.map(c => `- ${c.facts}`).join('\n')}`
      : null,
  ].filter(Boolean).join('\n\n');

  const opponentShort = lastGame.opponentName.split(' ').pop();
  const gameFallbacks = {
    narrative: `<em>${teamName}</em> ${result} against the ${lastGame.opponentName} at ${lastGame.venue}.`,
    headline: `${teamShort} ${lastGame.win ? 'top' : 'fall to'} ${opponentShort} ${lastGame.teamScore}–${lastGame.opponentScore}`,
    notes: boxScore.offense.map(b => ({ name: b.name, note: '' })),
  };

  console.log('[generate] Running Claude + YouTube in parallel (with fact-check)...');
  const [gameV, statRaw, arsenalRaw, spotlightRaw, storylinesV, ytVideoId] = await Promise.all([
    _generateVerifiedGameSections({ prompt: gamePrompt, facts: factsBlock, fallbacks: gameFallbacks, brandTitle, teamName }),
    _callClaude(statPrompt, 600, brandTitle, teamName),
    arsenalPrompt ? _callClaude(arsenalPrompt, 600, brandTitle, teamName) : Promise.resolve(null),
    spotlightPrompt ? _callClaude(spotlightPrompt, 300, brandTitle, teamName) : Promise.resolve(null),
    _generateVerifiedStorylines({ candidates: storylineCandidates, prompt: storylinePrompt, facts: factsBlock, brandTitle, teamName }),
    _fetchYouTubeVideoId(lastGame, teamName),
  ]);

  const { headline: headlineRaw, recap: narrative, playerNotes, pitching } = gameV.value;
  const seasonStorylines = storylinesV.value;
  // Per-section fact-check audit trail; empty when everything checked out clean.
  const verification = [gameV.record, storylinesV.record].filter(Boolean);

  let statOfGame = null;
  try {
    const parsed = JSON.parse(stripJsonFences(statRaw));
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

  // Merge Claude's per-pitch teaching notes into the measured arsenal data.
  // Numbers shown in the UI always come from the API; Claude only supplies prose.
  let pitchArsenal = null;
  if (arsenal) {
    let notesByCode = {};
    let arsenalInsight = null;
    try {
      const parsed = JSON.parse(stripJsonFences(arsenalRaw));
      for (const p of parsed.pitches ?? []) {
        if (p?.code) notesByCode[p.code] = p.note ?? null;
      }
      arsenalInsight = parsed.insight ?? null;
    } catch {
      console.warn('[generate] Failed to parse pitch arsenal JSON');
    }
    pitchArsenal = {
      pitcher: sp?.name ?? null,
      totalPitches: arsenal.totalPitches,
      hasSeasonMix: arsenal.hasSeasonMix,
      insight: arsenalInsight,
      pitches: arsenal.pitches.map(p => ({ ...p, note: notesByCode[p.code] ?? null })),
    };
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
    headline: (headlineRaw ?? '').replace(/^["'\s]+|["'\s.]+$/g, '') || null,
    narrative,
    playerNotes,
    pitching,
    statOfGame,
    storylines: seasonStorylines,
    pitchArsenal,
    hitterSpotlight: spotlight
      ? { ...spotlight, story: (spotlightRaw ?? '').trim() || null }
      : null,
    onThisDay,
    titleOdds,
    titleOddsTrend,
    ytVideoId,
    verification,
  };

  console.log('[generate] Report generated.');
  return report;
}

module.exports = { generateDailyReport };
