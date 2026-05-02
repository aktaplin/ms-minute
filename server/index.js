const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const mlb = require('./lib/mlb');
const { generateDailyReport } = require('./lib/generate');

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
});
