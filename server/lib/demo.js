'use strict';

const fs = require('fs');
const path = require('path');
const { ptDateToday } = require('./util');

// The demo edition: a fictional team whose report is a static fixture, so the
// site has something to show when MLB has no games (offseason, All-Star break)
// and something to develop against without spending API calls. Nothing here
// touches MLB, Haiku, YouTube or the Odds API.

const FIXTURE_PATH = path.join(__dirname, '..', 'content', 'demo', 'report.json');

let _fixture = null;
function _loadFixture() {
  if (!_fixture) {
    const { _comment, ...report } = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    _fixture = report;
  }
  return _fixture;
}

// YYYY-MM-DD, offset from a YYYY-MM-DD anchor (calendar math in UTC, so no DST drift)
function _shiftDate(ymd, days) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// A gentle climb toward today's number, so the WS Odds sparkline has a shape
function _oddsTrend(today, finalProb, days = 30) {
  const start = finalProb * 0.6;
  return Array.from({ length: days }, (_, i) => {
    const progress = i / (days - 1);
    const wobble = Math.sin(i * 1.3) * 0.004 * (1 - progress);
    return {
      date: _shiftDate(today, i - (days - 1)),
      implied_prob: Number((start + (finalProb - start) * progress + wobble).toFixed(4)),
    };
  });
}

// Fresh copy of the fixture with every date stamped relative to today, so the
// demo always reads as this morning's paper: last night's game, tomorrow's.
function buildDemoReport(teamConfig) {
  const today = ptDateToday();
  const report = structuredClone(_loadFixture());
  return {
    ...report,
    generatedAt: new Date().toISOString(),
    teamId: teamConfig.id,
    teamName: teamConfig.name,
    teamAbbr: teamConfig.abbr,
    brandTitle: teamConfig.brandTitle,
    divisionName: teamConfig.divisionName,
    demo: true,
    lastGame: { ...report.lastGame, date: _shiftDate(today, -1) },
    nextGame: report.nextGame && { ...report.nextGame, date: _shiftDate(today, 1) },
    onThisDay: report.onThisDay && { ...report.onThisDay, monthDay: today.slice(5) },
    titleOddsTrend: report.titleOdds ? _oddsTrend(today, report.titleOdds.impliedProb) : [],
  };
}

module.exports = { buildDemoReport };
