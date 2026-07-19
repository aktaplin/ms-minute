'use strict';

// Season storyline detector. Turns the team's recent schedule + current standings
// + a trailing standings-history window into a small set of "threads" that carry
// from game to game (win streaks, recent form, division momentum, where they sit).
//
// Every thread is computed from hard numbers here — this module never invents
// anything. Each thread ships with a deterministic, fully-grounded `fallbackText`
// sentence; generate.js may rewrite that in the house voice via Haiku, but the
// numbers always come from this file and are fact-checked before shipping.

const ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth'];

// Word form ("second") for prose sentences.
function ordinal(n) {
  if (n >= 1 && n < ORDINALS.length) return ORDINALS[n];
  return ordinalNum(n);
}

// Numeric form ("2nd") for compact badges.
function ordinalNum(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// MLB gamesBack is a string: "-" for the leader, otherwise "2.5". → number | null
function parseGb(gb) {
  if (gb == null) return null;
  if (gb === '-' || gb === 'E') return 0;
  const n = parseFloat(gb);
  return Number.isFinite(n) ? n : null;
}

// Games-back number as prose: JS stringifies 3.0 as "3" and 3.5 as "3.5",
// which is exactly the display we want.
function fmtGames(n) {
  return String(n);
}

function fmtMonthDay(isoDate) {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles',
  });
}

function daysBetween(isoA, isoB) {
  const a = Date.parse(isoA + 'T12:00:00Z');
  const b = Date.parse(isoB + 'T12:00:00Z');
  return Math.round(Math.abs(b - a) / (24 * 60 * 60 * 1000));
}

// --- Detectors -----------------------------------------------------------
// Each returns a thread object or null. A thread:
//   { kind, label, metric, value, facts, fallbackText }
// `facts`/`fallbackText` are the same grounded sentence; `metric` is a short
// badge string; `value` is the raw number for any UI that wants it.

// Current win/losing streak, walked back from the most recent game.
function detectStreak(teamName, recentResults) {
  if (!recentResults || recentResults.length === 0) return null;
  const last = recentResults[recentResults.length - 1];
  const win = last.win;

  const run = [];
  for (let i = recentResults.length - 1; i >= 0; i--) {
    if (recentResults[i].win === win) run.unshift(recentResults[i]);
    else break;
  }
  const count = run.length;
  if (count < 3) return null;

  const scored = run.reduce((s, g) => s + g.teamScore, 0);
  const allowed = run.reduce((s, g) => s + g.opponentScore, 0);
  const startLabel = fmtMonthDay(run[0].date);

  const facts = win
    ? `The ${teamName} have won ${count} games in a row (since ${startLabel}), outscoring their opponents ${scored}–${allowed} during the streak.`
    : `The ${teamName} have lost ${count} games in a row (since ${startLabel}) and have been outscored ${allowed}–${scored} during the slide.`;

  return {
    kind: 'streak',
    label: win ? 'Win Streak' : 'Losing Streak',
    metric: `${win ? 'W' : 'L'}${count}`,
    value: count,
    facts,
    fallbackText: facts,
  };
}

// Record over the most recent games in the window — surfaced only when the team
// is clearly hot or cold, so it doesn't just echo a streak that's already shown.
function detectRecentForm(teamName, recentResults, hasStreak) {
  if (!recentResults || recentResults.length < 10) return null;
  const window = recentResults.slice(-10);
  const wins = window.filter(g => g.win).length;
  const losses = window.length - wins;

  const hot = wins >= 7;
  const cold = wins <= 3;
  if (!hot && !cold) return null;
  // A dominant streak already tells this story; skip the redundant echo.
  if (hasStreak && (wins >= 9 || wins <= 1)) return null;

  const facts = `The ${teamName} are ${wins}–${losses} over their last ${window.length} games.`;
  return {
    kind: 'form',
    label: 'Last 10',
    metric: `${wins}–${losses}`,
    value: wins,
    facts,
    fallbackText: facts,
  };
}

// Movement in the division race over the trailing standings-history window.
// history: [{ date, gb, division_rank }] oldest → newest (numeric gb).
function detectMomentum(teamName, divisionName, standingsHistory, current, todayIso, minGapDays = 5) {
  if (current.gb == null || !standingsHistory || standingsHistory.length < 2) return null;

  // Oldest snapshot that is at least `minGapDays` back and has a usable gb.
  const anchor = standingsHistory.find(
    h => h.gb != null && daysBetween(h.date, todayIso) >= minGapDays
  );
  if (!anchor) return null;

  const delta = Number((anchor.gb - current.gb).toFixed(1)); // >0 = gained ground
  if (Math.abs(delta) < 1) return null;

  const gapDays = daysBetween(anchor.date, todayIso);
  const abs = fmtGames(Math.abs(delta));
  const standingNow = current.rank === 1
    ? 'in first place'
    : `${ordinal(current.rank)}, ${fmtGames(current.gb)} games back`;

  const facts =
    `Over the last ${gapDays} days, the ${teamName} have ${delta > 0 ? 'gained' : 'lost'} ${abs} ` +
    `games in the ${divisionName} race; they are now ${standingNow}.`;

  return {
    kind: 'momentum',
    label: divisionName,
    metric: `${delta > 0 ? '▲' : '▼'}${abs}`,
    value: delta,
    facts,
    fallbackText: facts,
  };
}

// Always-available fallback: where the team sits in its division right now.
function detectPosition(teamName, divisionName, current, leadOverSecond) {
  if (current.rank == null) return null;

  let facts;
  if (current.rank === 1) {
    const leadStr = leadOverSecond != null && leadOverSecond > 0
      ? `, ${fmtGames(leadOverSecond)} games ahead of second place`
      : '';
    facts = `The ${teamName} lead the ${divisionName}${leadStr}.`;
  } else {
    facts = `The ${teamName} sit ${ordinal(current.rank)} in the ${divisionName}, ${fmtGames(current.gb ?? 0)} games back of first.`;
  }

  return {
    kind: 'position',
    label: divisionName,
    metric: ordinalNum(current.rank),
    value: current.rank,
    facts,
    fallbackText: facts,
  };
}

// --- Assembly ------------------------------------------------------------

// Build the ranked thread list (max `limit`). Inputs:
//   teamConfig       — the team's config (name, divisionName, id)
//   standings        — getStandings() rows for the division
//   recentResults    — getRecentResults() oldest → newest
//   standingsHistory — getStandingsHistory() oldest → newest (numeric gb)
//   todayIso         — YYYY-MM-DD (PT) for date math
function build({ teamConfig, standings, recentResults, standingsHistory, todayIso, limit = 3 }) {
  const { name: teamName, divisionName, id: teamId } = teamConfig;

  // Our team's current spot in the division.
  const row = (standings ?? []).find(r => r.teamId === teamId);
  const current = row
    ? { rank: row.divisionRank, gb: parseGb(row.gb), wins: row.wins, losses: row.losses }
    : { rank: null, gb: null, wins: null, losses: null };

  // How far the leader is ahead of second place (for the "lead the division" line).
  let leadOverSecond = null;
  if (current.rank === 1 && standings) {
    const second = standings.find(r => r.divisionRank === 2);
    if (second) leadOverSecond = parseGb(second.gb);
  }

  const streak = detectStreak(teamName, recentResults);
  const momentum = detectMomentum(teamName, divisionName, standingsHistory, current, todayIso);
  const form = detectRecentForm(teamName, recentResults, !!streak);
  const position = detectPosition(teamName, divisionName, current, leadOverSecond);

  // Priority order. Position is the guaranteed fallback so the card is never empty
  // when standings exist; drop it if richer threads already fill the strip.
  const ranked = [streak, momentum, form, position].filter(Boolean);
  const richer = ranked.filter(t => t.kind !== 'position');
  const chosen = richer.length >= 2
    ? richer.slice(0, limit)
    : ranked.slice(0, limit);

  return chosen;
}

module.exports = { build, parseGb };
