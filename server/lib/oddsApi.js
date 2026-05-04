'use strict';

// World Series winner futures from The Odds API.
// One sport-key (`baseball_mlb_world_series_winner`) returns one event whose
// outcomes are the 30 teams. We average implied probability across US books
// for stability, and surface the median American line for display.

const ODDS_BASE = 'https://api.the-odds-api.com/v4';
const SPORT_KEY = 'baseball_mlb_world_series_winner';
const TTL_MS = 6 * 60 * 60 * 1000;

let _cached = null;

function _americanToImplied(odds) {
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

async function getWorldSeriesOdds() {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    console.warn('[odds] ODDS_API_KEY not set — skipping odds lookup');
    return null;
  }
  if (_cached && Date.now() - _cached.ts < TTL_MS) return _cached.val;

  try {
    const url = `${ODDS_BASE}/sports/${SPORT_KEY}/odds/` +
      `?apiKey=${key}&regions=us&markets=outrights&oddsFormat=american`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Odds API ${res.status}`);
    const events = await res.json();

    const event = Array.isArray(events) ? events[0] : null;
    if (!event) return null;

    const byTeam = new Map();
    for (const bm of event.bookmakers ?? []) {
      const market = bm.markets?.[0];
      for (const outcome of market?.outcomes ?? []) {
        const entry = byTeam.get(outcome.name) ?? { totalImplied: 0, oddsList: [] };
        entry.totalImplied += _americanToImplied(outcome.price);
        entry.oddsList.push(outcome.price);
        byTeam.set(outcome.name, entry);
      }
    }

    const result = {};
    for (const [teamName, entry] of byTeam) {
      const sorted = [...entry.oddsList].sort((a, b) => a - b);
      result[teamName] = {
        impliedProb: entry.totalImplied / entry.oddsList.length,
        medianOdds: sorted[Math.floor(sorted.length / 2)],
        bookmakerCount: entry.oddsList.length,
      };
    }

    _cached = { val: result, ts: Date.now() };
    return result;
  } catch (err) {
    console.error('[odds] Lookup failed:', err.message);
    return null;
  }
}

module.exports = { getWorldSeriesOdds };
