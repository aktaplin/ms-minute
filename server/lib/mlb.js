'use strict';

const MLB_BASE = 'https://statsapi.mlb.com';

const TEAM_CONFIGS = {
  mariners: {
    id: 136, divisionId: 200, leagueId: 103,
    abbr: 'SEA', name: 'Seattle Mariners', divisionName: 'AL West',
    brandTitle: "The M's Minute",
    edition: 'Seattle Mariners',
    theme: { navy: '#0C2340', teal: '#005C5C', lteal: '#A8C8C8' },
  },
  giants: {
    id: 137, divisionId: 203, leagueId: 104,
    abbr: 'SF', name: 'San Francisco Giants', divisionName: 'NL West',
    brandTitle: "The Giants' Glance",
    edition: 'San Francisco Giants',
    theme: { navy: '#27251F', teal: '#7B2D00', lteal: '#FD5A1E' },
  },
  dodgers: {
    id: 119, divisionId: 203, leagueId: 104,
    abbr: 'LAD', name: 'Los Angeles Dodgers', divisionName: 'NL West',
    brandTitle: 'The Dodger Dispatch',
    edition: 'Los Angeles Dodgers',
    theme: { navy: '#005A9C', teal: '#A5132A', lteal: '#FFFFFF' },
  },
  angels: {
    id: 108, divisionId: 200, leagueId: 103,
    abbr: 'LAA', name: 'Los Angeles Angels', divisionName: 'AL West',
    brandTitle: 'The Halo Headlines',
    edition: 'Los Angeles Angels',
    theme: { navy: '#003263', teal: '#BA0021', lteal: '#C4CED3' },
  },
  royals: {
    id: 118, divisionId: 202, leagueId: 103,
    abbr: 'KC', name: 'Kansas City Royals', divisionName: 'AL Central',
    brandTitle: 'The Royal Rundown',
    edition: 'Kansas City Royals',
    theme: { navy: '#004687', teal: '#7A5C28', lteal: '#FFFFFF' },
  },
  yankees: {
    id: 147, divisionId: 201, leagueId: 103,
    abbr: 'NYY', name: 'New York Yankees', divisionName: 'AL East',
    brandTitle: 'The Bronx Brief',
    edition: 'New York Yankees',
    theme: { navy: '#0C2340', teal: '#1C2841', lteal: '#C4CED3' },
  },
};

const DEFAULT_TEAM_KEY = 'mariners';

function resolveTeamKey(input) {
  return Object.prototype.hasOwnProperty.call(TEAM_CONFIGS, input) ? input : DEFAULT_TEAM_KEY;
}

const _cache = new Map();

function _getCached(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < entry.ttlMs) return entry.val;
  return null;
}

function _setCached(key, val, ttlMs = 5 * 60 * 1000) {
  _cache.set(key, { val, ts: Date.now(), ttlMs });
}

async function _mlbFetch(path) {
  const cached = _getCached(path);
  if (cached) return cached;
  const res = await fetch(`${MLB_BASE}${path}`);
  if (!res.ok) throw new Error(`MLB API ${res.status}: ${path}`);
  const data = await res.json();
  _setCached(path, data);
  return data;
}

// Returns a YYYY-MM-DD string in Pacific Time, offset by N days
function _ptDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

async function _getGamesOnDate(dateStr, teamId) {
  const data = await _mlbFetch(
    `/api/v1/schedule?sportId=1&teamId=${teamId}&date=${dateStr}` +
    `&hydrate=linescore,decisions,probablePitcher,team`
  );
  if (!data.dates || data.dates.length === 0) return [];
  return data.dates[0].games || [];
}

// Most recent completed regular-season game for the given team
async function getLastGame(teamId) {
  for (let i = 1; i <= 10; i++) {
    const dateStr = _ptDate(-i);
    const games = await _getGamesOnDate(dateStr, teamId);
    const game = games.find(
      g => g.status.abstractGameState === 'Final' && g.gameType === 'R'
    );
    if (!game) continue;

    const { teams, venue, gamePk } = game;
    const teamSide = teams.home.team.id === teamId ? 'home' : 'away';
    const team = teams[teamSide];
    const opponent = teams[teamSide === 'home' ? 'away' : 'home'];

    return {
      gamePk,
      date: dateStr,
      teamSide,
      teamScore: team.score,
      opponentScore: opponent.score,
      opponentName: opponent.team.name,
      opponentAbbr: opponent.team.abbreviation ?? opponent.team.name.split(' ').pop().slice(0, 3).toUpperCase(),
      venue: venue.name,
      win: !!team.isWinner,
    };
  }
  throw new Error(`No completed game found in the last 10 days for team ${teamId}`);
}

// Top offensive performers + starting pitcher for a given game
async function getBoxScore(gamePk, teamId) {
  const data = await _mlbFetch(`/api/v1/game/${gamePk}/boxscore`);

  const teamSide = data.teams.home.team.id === teamId ? 'home' : 'away';
  const teamData = data.teams[teamSide];

  const batters = Object.values(teamData.players)
    .filter(p => p.stats.batting && p.stats.batting.atBats > 0)
    .map(p => ({
      name: p.person.fullName,
      position: p.position.abbreviation,
      atBats: p.stats.batting.atBats,
      hits: p.stats.batting.hits,
      homeRuns: p.stats.batting.homeRuns,
      rbi: p.stats.batting.rbi,
      runs: p.stats.batting.runs,
      avg: p.seasonStats?.batting?.avg ?? '.---',
      obp: p.seasonStats?.batting?.obp ?? '.---',
      slg: p.seasonStats?.batting?.slg ?? '.---',
      ops: p.seasonStats?.batting?.ops ?? '.---',
      // Weighted score for sorting: hits + 2×HR + RBI
      _score: p.stats.batting.hits + 2 * p.stats.batting.homeRuns + p.stats.batting.rbi,
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 4)
    .map(({ _score, ...rest }) => rest);

  const pitcherIds = teamData.pitchers ?? [];
  const toPitcher = (p) => ({
    id: p.person.id,
    name: p.person.fullName,
    inningsPitched: p.stats.pitching?.inningsPitched ?? '0.0',
    strikeOuts: p.stats.pitching?.strikeOuts ?? 0,
    earnedRuns: p.stats.pitching?.earnedRuns ?? 0,
    hits: p.stats.pitching?.hits ?? 0,
    walks: p.stats.pitching?.baseOnBalls ?? 0,
    seasonEra: p.seasonStats?.pitching?.era ?? '--',
    seasonWhip: p.seasonStats?.pitching?.whip ?? '--',
    seasonK9: p.seasonStats?.pitching?.strikeOutsPer9Inn ?? '--',
  });

  const sp = pitcherIds[0] != null ? teamData.players[`ID${pitcherIds[0]}`] : null;
  const startingPitcher = sp ? toPitcher(sp) : null;

  const relievers = pitcherIds
    .slice(1)
    .map(id => teamData.players[`ID${id}`])
    .filter(Boolean)
    .map(toPitcher);

  return { offense: batters, startingPitcher, relievers };
}

// Next scheduled regular-season game for the given team (not yet started)
async function getNextGame(teamId) {
  for (let i = 0; i <= 10; i++) {
    const dateStr = _ptDate(i);
    const games = await _getGamesOnDate(dateStr, teamId);
    const game = games.find(
      g => g.status.abstractGameState === 'Preview' && g.gameType === 'R'
    );
    if (!game) continue;

    const { teams, venue, gameDate } = game;
    const teamSide = teams.home.team.id === teamId ? 'home' : 'away';
    const team = teams[teamSide];
    const opponent = teams[teamSide === 'home' ? 'away' : 'home'];

    const gameTime = new Date(gameDate).toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return {
      date: dateStr,
      opponentName: opponent.team.name,
      opponentAbbr: opponent.team.abbreviation ?? opponent.team.name.split(' ').pop().slice(0, 3).toUpperCase(),
      venue: venue.name,
      gameTime: `${gameTime} PT`,
      probablePitcher: team.probablePitcher?.fullName ?? 'TBD',
    };
  }
  return null;
}

async function getStandings(divisionId, leagueId) {
  const season = new Date().getFullYear();
  const data = await _mlbFetch(
    `/api/v1/standings?leagueId=${leagueId}&season=${season}&standingsTypes=regularSeason`
  );

  const division = data.records.find(r => r.division.id === divisionId);
  if (!division) throw new Error(`Division ${divisionId} standings not found`);

  return division.teamRecords.map(tr => ({
    teamId: tr.team.id,
    team: tr.team.name,
    wins: tr.wins,
    losses: tr.losses,
    pct: tr.leagueRecord.pct,
    gb: tr.gamesBack,
    divisionRank: parseInt(tr.divisionRank, 10),
  }));
}

// Returns play-by-play derived data for a completed game:
//   hrMap: playerName (lowercase) → [rbi per HR play], for annotating batter lines
//   scoringTimeline: ordered list of half-innings where runs scored, each with key events
//   pitcherOrder: pitcherId → 0-based index of first appearance (both teams), the
//     authoritative order pitchers entered the game — more reliable than the
//     boxscore pitchers array for narrating who came in before whom
async function getPlayByPlayData(gamePk, teamId) {
  const data = await _mlbFetch(`/api/v1.1/game/${gamePk}/feed/live`);
  const allPlays = data.liveData?.plays?.allPlays ?? [];
  const teamSide = data.gameData?.teams?.home?.id === teamId ? 'home' : 'away';

  const hrMap = {};
  const halfInnings = {};  // key: "${inning}-${half}"
  const pitcherOrder = {};
  let pitcherSeq = 0;
  let prevHome = 0;
  let prevAway = 0;

  for (const play of allPlays) {
    // First-appearance order (allPlays is chronological)
    const pitcherId = play.matchup?.pitcher?.id;
    if (pitcherId != null && !(pitcherId in pitcherOrder)) {
      pitcherOrder[pitcherId] = pitcherSeq++;
    }

    const homeScore = play.result?.homeScore ?? prevHome;
    const awayScore = play.result?.awayScore ?? prevAway;
    const inning = play.about?.inning;
    const half = play.about?.halfInning; // 'top' | 'bottom'

    // HR map
    if (play.result?.event === 'Home Run') {
      const name = play.matchup?.batter?.fullName;
      if (name) {
        const key = name.toLowerCase();
        if (!hrMap[key]) hrMap[key] = [];
        hrMap[key].push(play.result.rbi ?? 1);
      }
    }

    // Scoring timeline: collect every play where the score changed
    if ((homeScore !== prevHome || awayScore !== prevAway) && inning != null) {
      const key = `${inning}-${half}`;
      if (!halfInnings[key]) {
        halfInnings[key] = { inning, half, events: [] };
      }
      const rbi = play.result?.rbi ?? 0;
      let eventLabel = play.result?.event ?? 'Unknown';
      if (eventLabel === 'Home Run') {
        const type = rbi === 1 ? 'Solo' : rbi === 2 ? '2-run' : rbi === 3 ? '3-run' : rbi === 4 ? 'Grand Slam' : `${rbi}-run`;
        eventLabel = `${type} Home Run`;
      }
      halfInnings[key].events.push({
        event: eventLabel,
        batter: play.matchup?.batter?.fullName ?? null,
        rbi,
        teamScore: teamSide === 'home' ? homeScore : awayScore,
        oppScore:  teamSide === 'home' ? awayScore : homeScore,
      });
    }

    prevHome = homeScore;
    prevAway = awayScore;
  }

  // Sort half-innings chronologically (top before bottom within each inning)
  const sorted = Object.values(halfInnings).sort((a, b) =>
    a.inning !== b.inning ? a.inning - b.inning : (a.half === 'top' ? -1 : 1)
  );

  // Annotate each half-inning with lead status and which side is scoring
  let prevLeader = 'none';
  const scoringTimeline = sorted.map(entry => {
    const last = entry.events[entry.events.length - 1];
    const isTeam = (entry.half === 'bottom') === (teamSide === 'home');
    const leader = last.teamScore > last.oppScore ? 'team' : last.teamScore < last.oppScore ? 'opp' : 'tied';
    const isLeadChange = leader !== prevLeader && prevLeader !== 'none';
    prevLeader = leader;
    return { inning: entry.inning, half: entry.half, isTeam, isLeadChange, events: entry.events };
  });

  return { hrMap, scoringTimeline, pitcherOrder };
}

// Per-pitch aggregation for one pitcher in a completed game.
// Returns { totalPitches, pitches: [{ code, name, count, gamePct, avgVelo, maxVelo, whiffs }] }
// sorted by usage, or null if no pitch data exists for the pitcher.
async function getPitchArsenal(gamePk, pitcherId) {
  const data = await _mlbFetch(`/api/v1.1/game/${gamePk}/feed/live`);
  const allPlays = data.liveData?.plays?.allPlays ?? [];

  const byType = {};
  let total = 0;

  for (const play of allPlays) {
    if (play.matchup?.pitcher?.id !== pitcherId) continue;
    for (const ev of play.playEvents ?? []) {
      if (!ev.isPitch) continue;
      const type = ev.details?.type;
      if (!type?.code) continue;

      total++;
      if (!byType[type.code]) {
        byType[type.code] = {
          code: type.code, name: type.description,
          count: 0, veloSum: 0, veloCount: 0, maxVelo: null, whiffs: 0,
        };
      }
      const t = byType[type.code];
      t.count++;

      const speed = ev.pitchData?.startSpeed;
      if (typeof speed === 'number') {
        t.veloSum += speed;
        t.veloCount++;
        if (t.maxVelo == null || speed > t.maxVelo) t.maxVelo = speed;
      }
      if ((ev.details?.description ?? '').includes('Swinging Strike')) t.whiffs++;
    }
  }

  if (total === 0) return null;

  const pitches = Object.values(byType)
    .map(t => ({
      code: t.code,
      name: t.name,
      count: t.count,
      gamePct: Math.round((t.count / total) * 100),
      avgVelo: t.veloCount > 0 ? Number((t.veloSum / t.veloCount).toFixed(1)) : null,
      maxVelo: t.maxVelo != null ? Number(t.maxVelo.toFixed(1)) : null,
      whiffs: t.whiffs,
    }))
    .sort((a, b) => b.count - a.count);

  return { totalPitches: total, pitches };
}

// Season-long pitch mix via the pitchArsenal stat group.
// Returns { [pitchCode]: { pct, avgVelo } } or null (e.g., a debut with no season data).
async function getSeasonPitchMix(pitcherId, season = new Date().getFullYear()) {
  try {
    const data = await _mlbFetch(
      `/api/v1/people/${pitcherId}/stats?stats=pitchArsenal&season=${season}`
    );
    const splits = data.stats?.[0]?.splits ?? [];
    if (splits.length === 0) return null;

    const mix = {};
    for (const s of splits) {
      const stat = s.stat;
      if (!stat?.type?.code) continue;
      mix[stat.type.code] = {
        pct: Math.round(stat.percentage * 100),
        avgVelo: Number(stat.averageSpeed.toFixed(1)),
      };
    }
    return Object.keys(mix).length > 0 ? mix : null;
  } catch {
    return null;
  }
}

// Game arsenal merged with season usage: each pitch gains seasonPct + deltaPts
// (percentage-point difference vs. season norm), null when season data is unavailable.
async function getStarterArsenal(gamePk, pitcherId) {
  if (!pitcherId) return null;
  const arsenal = await getPitchArsenal(gamePk, pitcherId);
  if (!arsenal) return null;

  const seasonMix = await getSeasonPitchMix(pitcherId);
  const pitches = arsenal.pitches.map(p => {
    const season = seasonMix?.[p.code] ?? null;
    return {
      ...p,
      seasonPct: season ? season.pct : null,
      deltaPts: season ? p.gamePct - season.pct : null,
    };
  });

  return { totalPitches: arsenal.totalPitches, pitches, hasSeasonMix: !!seasonMix };
}

// Statcast batted-ball story for the team's most interesting hitter of the game.
// Returns { id, name, ballsInPlay: [{ event, exitVelo, launchAngle, distance }],
//           hardHits, maxExitVelo } or null when no tracked batted balls exist.
// Hard-hit = 95+ mph exit velocity (MLB's standard threshold).
async function getHitterSpotlight(gamePk, teamId) {
  const data = await _mlbFetch(`/api/v1.1/game/${gamePk}/feed/live`);
  const allPlays = data.liveData?.plays?.allPlays ?? [];
  const teamSide = data.gameData?.teams?.home?.id === teamId ? 'home' : 'away';

  const byBatter = {};
  for (const play of allPlays) {
    // Top half = away team batting
    const battingSide = play.about?.halfInning === 'top' ? 'away' : 'home';
    if (battingSide !== teamSide) continue;
    const batter = play.matchup?.batter;
    if (!batter?.id) continue;

    for (const ev of play.playEvents ?? []) {
      // Only the ball that ended the play — Statcast also tracks some fouls
      if (!ev.details?.isInPlay) continue;
      const hd = ev.hitData;
      if (!hd || typeof hd.launchSpeed !== 'number') continue;

      if (!byBatter[batter.id]) {
        byBatter[batter.id] = { id: batter.id, name: batter.fullName, ballsInPlay: [], hardHits: 0, maxExitVelo: 0 };
      }
      const b = byBatter[batter.id];
      b.ballsInPlay.push({
        event: play.result?.event ?? null,
        exitVelo: Number(hd.launchSpeed.toFixed(1)),
        launchAngle: typeof hd.launchAngle === 'number' ? Math.round(hd.launchAngle) : null,
        distance: typeof hd.totalDistance === 'number' ? Math.round(hd.totalDistance) : null,
      });
      if (hd.launchSpeed >= 95) b.hardHits++;
      if (hd.launchSpeed > b.maxExitVelo) b.maxExitVelo = Number(hd.launchSpeed.toFixed(1));
    }
  }

  const candidates = Object.values(byBatter).filter(b => b.ballsInPlay.length > 0);
  if (candidates.length === 0) return null;

  // Most hard-hit balls; tiebreak on hardest single ball, then most balls in play
  candidates.sort((a, b) =>
    b.hardHits - a.hardHits || b.maxExitVelo - a.maxExitVelo || b.ballsInPlay.length - a.ballsInPlay.length
  );
  return candidates[0];
}

// Live state of a game in progress (short 30s cache)
async function getLiveGame(gamePk) {
  const path = `/api/v1.1/game/${gamePk}/feed/live`;
  const cached = _getCached(path);
  if (cached) return cached;

  const res = await fetch(`${MLB_BASE}${path}`);
  if (!res.ok) throw new Error(`MLB API ${res.status}: ${path}`);
  const data = await res.json();

  const { linescore } = data.liveData;
  const { teams, status } = data.gameData;

  const result = {
    status: status.abstractGameState,
    currentInning: linescore.currentInning ?? 0,
    isTopInning: linescore.isTopInning ?? true,
    homeTeam: { name: teams.home.name, score: linescore.teams?.home?.runs ?? 0 },
    awayTeam: { name: teams.away.name, score: linescore.teams?.away?.runs ?? 0 },
    runners: {
      first: !!linescore.offense?.first,
      second: !!linescore.offense?.second,
      third: !!linescore.offense?.third,
    },
    outs: linescore.outs ?? 0,
  };

  _setCached(path, result, 30 * 1000);
  return result;
}

module.exports = { TEAM_CONFIGS, DEFAULT_TEAM_KEY, resolveTeamKey, getLastGame, getBoxScore, getNextGame, getStandings, getPlayByPlayData, getLiveGame, getPitchArsenal, getSeasonPitchMix, getStarterArsenal, getHitterSpotlight };
