const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const mlb = require('./lib/mlb');
const { TEAM_CONFIGS, resolveTeamKey } = mlb;
const { generateDailyReport } = require('./lib/generate');
const db = require('./lib/db');
const { startCron } = require('./lib/cron');
const { ptDateToday } = require('./lib/util');

const app = express();
const PORT = process.env.PORT || 3001;

// Behind Railway's proxy, req.ip must come from X-Forwarded-For
app.set('trust proxy', 1);
app.use(express.json());

function hasValidToken(authHeader) {
  const token = process.env.REGEN_TOKEN;
  if (!token || !authHeader?.startsWith('Bearer ')) return false;
  const given = Buffer.from(authHeader.slice(7));
  const want = Buffer.from(token);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

// Dev endpoints trigger paid API calls on every hit: open locally,
// Bearer REGEN_TOKEN required in production.
function requireDevAccess(req, res, next) {
  if (process.env.NODE_ENV !== 'production' || hasValidToken(req.headers.authorization)) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

// Minimal fixed-window per-IP rate limiter — enough to stop cost-abuse loops
// without a dependency. Window state is in-memory (single-process app).
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 5000) {
      for (const [ip, e] of hits) if (now - e.start >= windowMs) hits.delete(ip);
    }
    const entry = hits.get(req.ip);
    if (!entry || now - entry.start >= windowMs) {
      hits.set(req.ip, { start: now, count: 1 });
      return next();
    }
    if (++entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.start + windowMs - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  };
}

// Health check is registered BEFORE the rate limiter so platform probes
// (Railway polls this rapidly during deploy) are never throttled — a 429 here
// reads as an unhealthy deploy and gets the container SIGTERM'd.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 60 }));

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
app.get('/api/dev/mlb', requireDevAccess, async (req, res) => {
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

// Serve today's report from cache, generating on miss. Concurrent misses for
// the same team share one in-flight generation instead of each paying for it.
const inflight = new Map();
function getOrGenerateReport(teamKey) {
  const cacheKey = `${ptDateToday()}-${teamKey}`;
  const cached = db.getReport(cacheKey);
  if (cached) return Promise.resolve(cached);
  if (inflight.has(cacheKey)) return inflight.get(cacheKey);

  const p = generateDailyReport(TEAM_CONFIGS[teamKey])
    .then(report => {
      db.saveReport(cacheKey, report);
      return report;
    })
    .finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, p);
  return p;
}

app.get('/api/report', async (req, res) => {
  const teamKey = resolveTeamKey(req.query.team);
  try {
    res.json(await getOrGenerateReport(teamKey));
  } catch (err) {
    console.error('[/api/report]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Force-regenerate today's report (dev / admin use)
app.post('/api/report/regenerate', async (req, res) => {
  if (!hasValidToken(req.headers.authorization)) {
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

// Dev-only: generate a full report on demand (bypasses the cache)
app.get('/api/dev/report', requireDevAccess, async (req, res) => {
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
