'use strict';

const MLB_BASE = 'https://statsapi.mlb.com';
const MARINERS_ID = 136;
const AL_WEST_DIVISION_ID = 200;

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

async function _getGamesOnDate(dateStr) {
  const data = await _mlbFetch(
    `/api/v1/schedule?sportId=1&teamId=${MARINERS_ID}&date=${dateStr}` +
    `&hydrate=linescore,decisions,probablePitcher,team`
  );
  if (!data.dates || data.dates.length === 0) return [];
  return data.dates[0].games || [];
}

// Most recent completed regular-season Mariners game
async function getLastGame() {
  for (let i = 1; i <= 10; i++) {
    const dateStr = _ptDate(-i);
    const games = await _getGamesOnDate(dateStr);
    const game = games.find(
      g => g.status.abstractGameState === 'Final' && g.gameType === 'R'
    );
    if (!game) continue;

    const { teams, venue, gamePk } = game;
    const marinersSide = teams.home.team.id === MARINERS_ID ? 'home' : 'away';
    const mariners = teams[marinersSide];
    const opponent = teams[marinersSide === 'home' ? 'away' : 'home'];

    return {
      gamePk,
      date: dateStr,
      marinersSide,
      marinersScore: mariners.score,
      opponentScore: opponent.score,
      opponentName: opponent.team.name,
      opponentAbbr: opponent.team.abbreviation ?? opponent.team.name.split(' ').pop().slice(0, 3).toUpperCase(),
      venue: venue.name,
      win: !!mariners.isWinner,
    };
  }
  throw new Error('No completed Mariners game found in the last 10 days');
}

// Top offensive performers + starting pitcher for a given game
async function getBoxScore(gamePk) {
  const data = await _mlbFetch(`/api/v1/game/${gamePk}/boxscore`);

  const marinersSide = data.teams.home.team.id === MARINERS_ID ? 'home' : 'away';
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
      }
    : null;

  return { offense: batters, startingPitcher };
}

// Next scheduled regular-season Mariners game (not yet started)
async function getNextGame() {
  for (let i = 0; i <= 10; i++) {
    const dateStr = _ptDate(i);
    const games = await _getGamesOnDate(dateStr);
    const game = games.find(
      g => g.status.abstractGameState === 'Preview' && g.gameType === 'R'
    );
    if (!game) continue;

    const { teams, venue, gameDate } = game;
    const marinersSide = teams.home.team.id === MARINERS_ID ? 'home' : 'away';
    const mariners = teams[marinersSide];
    const opponent = teams[marinersSide === 'home' ? 'away' : 'home'];

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
      probablePitcher: mariners.probablePitcher?.fullName ?? 'TBD',
    };
  }
  return null;
}

// AL West standings
async function getStandings() {
  const season = new Date().getFullYear();
  const data = await _mlbFetch(
    `/api/v1/standings?leagueId=103&season=${season}&standingsTypes=regularSeason`
  );

  const alWest = data.records.find(r => r.division.id === AL_WEST_DIVISION_ID);
  if (!alWest) throw new Error('AL West standings not found');

  return alWest.teamRecords.map(tr => ({
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

module.exports = { getLastGame, getBoxScore, getNextGame, getStandings, getLiveGame };
