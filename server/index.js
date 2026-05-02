const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const mlb = require('./lib/mlb');
const { TEAM_CONFIGS } = mlb;
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
  const teamKey = (req.query.team === 'giants') ? 'giants' : 'mariners';
  const tc = TEAM_CONFIGS[teamKey];
  try {
    const lastGame = await mlb.getLastGame(tc.id);
    const [boxScore, nextGame, standings] = await Promise.all([
      mlb.getBoxScore(lastGame.gamePk, tc.id),
      mlb.getNextGame(tc.id),
      mlb.getStandings(tc.divisionId, tc.leagueId),
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
  const teamKey = (req.query.team === 'giants') ? 'giants' : 'mariners';
  const cacheKey = `${ptDateToday()}-${teamKey}`;
  const cached = db.getReport(cacheKey);
  if (cached) return res.json(cached);

  try {
    const report = await generateDailyReport(TEAM_CONFIGS[teamKey]);
    db.saveReport(cacheKey, report);
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
  const teamKey = (req.query.team === 'giants') ? 'giants' : 'mariners';
  try {
    const report = await generateDailyReport(TEAM_CONFIGS[teamKey]);
    db.saveReport(`${ptDateToday()}-${teamKey}`, report);
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

// Serve the built React app if client/dist exists (i.e. in production)
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startCron();
});
