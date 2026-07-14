'use strict';

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content', 'history');

// teamKey → parsed events object, or null when no history file exists for the team
const _teamHistory = new Map();

function _loadTeamHistory(teamKey) {
  if (_teamHistory.has(teamKey)) return _teamHistory.get(teamKey);
  let events = null;
  try {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, `${teamKey}.json`), 'utf8');
    events = JSON.parse(raw);
  } catch {
    events = null; // missing or malformed file → the feature silently no-ops for this team
  }
  _teamHistory.set(teamKey, events);
  return events;
}

// Featured franchise moment for a calendar date.
// monthDay is "MM-DD"; returns { monthDay, year, headline, story } or null.
function getOnThisDay(teamKey, monthDay) {
  const events = _loadTeamHistory(teamKey);
  const event = events?.[monthDay];
  if (!event) return null;
  return { monthDay, year: event.year, headline: event.headline, story: event.story };
}

module.exports = { getOnThisDay };
