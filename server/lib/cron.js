'use strict';

const cron = require('node-cron');
const { generateDailyReport } = require('./generate');
const { TEAM_CONFIGS } = require('./mlb');
const db = require('./db');
const { ptDateToday } = require('./util');

async function runOneTeam(teamKey, maxAttempts = 3) {
  const teamConfig = TEAM_CONFIGS[teamKey];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[cron] Generating ${teamKey} report (attempt ${attempt}/${maxAttempts})...`);
      const report = await generateDailyReport(teamConfig);
      const cacheKey = `${ptDateToday()}-${teamKey}`;
      db.saveReport(cacheKey, report);
      console.log(`[cron] Cached ${cacheKey}.`);
      return;
    } catch (err) {
      console.error(`[cron] ${teamKey} attempt ${attempt} failed:`, err.message);
      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt - 1) * 60 * 1000; // 1m, 2m, 4m
        console.log(`[cron] Retrying ${teamKey} in ${delayMs / 1000}s...`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        console.error(`[cron] ${teamKey} exhausted retries; will be generated on next user request.`);
      }
    }
  }
}

async function runAllTeams() {
  for (const teamKey of Object.keys(TEAM_CONFIGS)) {
    await runOneTeam(teamKey);
  }
}

function startCron() {
  // 5:00 AM Pacific Time every day
  cron.schedule('0 5 * * *', () => {
    console.log('[cron] 5am PT — starting daily report generation for all teams.');
    runAllTeams();
  }, { timezone: 'America/Los_Angeles' });

  console.log('[cron] Scheduled: daily report generation at 5:00 AM PT.');
}

module.exports = { startCron, runAllTeams, runOneTeam };
