'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'reports.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    date TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

function getReport(date) {
  const row = db.prepare('SELECT json FROM reports WHERE date = ?').get(date);
  return row ? JSON.parse(row.json) : null;
}

function saveReport(date, report) {
  db.prepare(
    'INSERT OR REPLACE INTO reports (date, json, created_at) VALUES (?, ?, ?)'
  ).run(date, JSON.stringify(report), Date.now());
}

function getRecentStatAbbrs(teamKey, limit = 7) {
  const rows = db.prepare(
    "SELECT json FROM reports WHERE date LIKE ? ORDER BY date DESC LIMIT ?"
  ).all(`%-${teamKey}`, limit);
  return rows
    .map(r => { try { return JSON.parse(r.json).statOfGame?.abbr ?? null; } catch { return null; } })
    .filter(Boolean);
}

module.exports = { getReport, saveReport, getRecentStatAbbrs };
