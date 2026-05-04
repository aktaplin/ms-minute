const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const mlb = require('./lib/mlb');
const { TEAM_CONFIGS, resolveTeamKey } = mlb;
const { generateDailyReport } = require('./lib/generate');
const db = require('./lib/db');
const { startCron } = require('./lib/cron');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public team registry — drives the client toggle, theming, and titles
app.get('/api/teams', (req, res) => {
  const teams = Object.entries(TEAM_CONFIGS).map(([key, c]) => ({
    key,
    name: c.name,
    abbr: c.abbr,
    divisionName: c.divisionName,
    brandTitle: c.brandTitle,
    edition: c.edition,
    theme: c.theme,
  }));
  res.json({ teams });
});

// Dev-only: smoke test all MLB lib functions
app.get('/api/dev/mlb', async (req, res) => {
  const tc = TEAM_CONFIGS[resolveTeamKey(req.query.team)];
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
  const teamKey = resolveTeamKey(req.query.team);
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
  const teamKeys = req.query.team === 'all'
    ? Object.keys(TEAM_CONFIGS)
    : [resolveTeamKey(req.query.team)];
  const results = [];
  for (const key of teamKeys) {
    try {
      const report = await generateDailyReport(TEAM_CONFIGS[key]);
      db.saveReport(`${ptDateToday()}-${key}`, report);
      results.push({ team: key, ok: true, generatedAt: report.generatedAt });
    } catch (err) {
      console.error('[/api/report/regenerate]', key, err.message);
      results.push({ team: key, ok: false, error: err.message });
    }
  }
  res.json({ results });
});

// Dev-only: generate a full report on demand
app.get('/api/dev/report', async (req, res) => {
  const teamKey = resolveTeamKey(req.query.team);
  try {
    const report = await generateDailyReport(TEAM_CONFIGS[teamKey]);
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
