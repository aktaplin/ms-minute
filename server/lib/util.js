'use strict';

// Today's date as YYYY-MM-DD in Pacific Time — the app's canonical "report day".
function ptDateToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

// Strip markdown code fences a model sometimes wraps around JSON output.
function stripJsonFences(raw) {
  return (raw ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
}

module.exports = { ptDateToday, stripJsonFences };
