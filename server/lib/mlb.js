'use strict';

const MLB_BASE = 'https://statsapi.mlb.com';

const TEAM_CONFIGS = {
  mariners: { id: 136, divisionId: 200, leagueId: 103, abbr: 'SEA', name: 'Seattle Mariners', divisionName: 'AL West' },
  giants:   { id: 137, divisionId: 203, leagueId: 104, abbr: 'SF',  name: 'San Francisco Giants', divisionName: 'NL West' },
};

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
      marinersScore: team.score,
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

  const marinersSide = data.teams.home.team.id === teamId ? 'home' : 'away';
  const marinersTeam = data.teams[marinersSide];

  const batters = Object.values(marinersTeam.players)
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

  const spId = marinersTeam.pitchers[0];
  const sp = marinersTeam.players[`ID${spId}`];
  const startingPitcher = sp
    ? {
        name: sp.person.fullName,
        inningsPitched: sp.stats.pitching?.inningsPitched ?? '0.0',
        strikeOuts: sp.stats.pitching?.strikeOuts ?? 0,
        earnedRuns: sp.stats.pitching?.earnedRuns ?? 0,
        hits: sp.stats.pitching?.hits ?? 0,
        walks: sp.stats.pitching?.baseOnBalls ?? 0,
        seasonEra: sp.seasonStats?.pitching?.era ?? '--',
        seasonWhip: sp.seasonStats?.pitching?.whip ?? '--',
        seasonK9: sp.seasonStats?.pitching?.strikeOutsPer9Inn ?? '--',
      }
    : null;

  return { offense: batters, startingPitcher };
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

module.exports = { TEAM_CONFIGS, getLastGame, getBoxScore, getNextGame, getStandings, getLiveGame };
