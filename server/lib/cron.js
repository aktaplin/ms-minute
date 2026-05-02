'use strict';

const cron = require('node-cron');
const { generateDailyReport } = require('./generate');
const db = require('./db');

function ptDateToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

async function runWithRetry(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[cron] Generating report (attempt ${attempt}/${maxAttempts})...`);
      const report = await generateDailyReport();
      db.saveReport(ptDateToday(), report);
      console.log(`[cron] Report generated and cached for ${ptDateToday()}.`);
      return;
    } catch (err) {
      console.error(`[cron] Attempt ${attempt} failed:`, err.message);
      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt - 1) * 60 * 1000; // 1m, 2m, 4m
        console.log(`[cron] Retrying in ${delayMs / 1000}s...`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        console.error('[cron] All attempts failed. Report will be generated on next user request.');
      }
    }
  }
}

function startCron() {
  // 5:00 AM Pacific Time every day
  cron.schedule('0 5 * * *', () => {
    console.log('[cron] 5am PT — starting daily report generation.');
    runWithRetry();
  }, { timezone: 'America/Los_Angeles' });

  console.log('[cron] Scheduled: daily report generation at 5:00 AM PT.');
}

module.exports = { startCron, runWithRetry };
