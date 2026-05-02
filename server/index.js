const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const mlb = require('./lib/mlb');
const { generateDailyReport } = require('./lib/generate');
const db = require('./lib/db');
const { startCron } = require('./lib/cron');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dev-only: smoke test all MLB lib functions
app.get('/api/dev/mlb', async (req, res) => {
  try {
    const lastGame = await mlb.getLastGame();
    const [boxScore, nextGame, standings] = await Promise.all([
      mlb.getBoxScore(lastGame.gamePk),
      mlb.getNextGame(),
      mlb.getStandings(),
    ]);
    res.json({ lastGame, boxScore, nextGame, standings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function ptDateToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

// Main report endpoint — serves today's cached report, generating it on cache miss
app.get('/api/report', async (req, res) => {
  const today = ptDateToday();
  const cached = db.getReport(today);
  if (cached) return res.json(cached);

  try {
    const report = await generateDailyReport();
    db.saveReport(today, report);
    res.json(report);
  } catch (err) {
    console.error('[/api/report]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Force-regenerate today's report (dev / admin use)
app.post('/api/report/regenerate', async (req, res) => {
  const token = process.env.REGEN_TOKEN;
  if (!token || req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const report = await generateDailyReport();
    db.saveReport(ptDateToday(), report);
    res.json({ ok: true, generatedAt: report.generatedAt });
  } catch (err) {
    console.error('[/api/report/regenerate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Dev-only: generate a full report on demand
app.get('/api/dev/report', async (req, res) => {
  try {
    const report = await generateDailyReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startCron();
});
