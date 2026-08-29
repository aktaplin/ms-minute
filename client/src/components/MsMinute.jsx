import { Fragment, useState, useEffect, useRef, useCallback } from 'react';

const PAPER   = '#F6F1E7';
const PAPER2  = '#EDE7D8';
const INK     = '#1A1A1A';
const INK2    = '#444444';
const MUTED   = '#5C5347';
const LGREY   = '#C8D4DC';
const WIN_RED   = '#8B1A1A';
const WIN_GREEN = '#245C3B';

const FRAUNCES = "'Fraunces', Georgia, serif";
const INTER    = "'Inter', system-ui, sans-serif";
const OPSZ9    = { fontVariationSettings: "'opsz' 9" };

// Visually hidden, still announced — for header cells whose meaning is obvious
// on the page but empty to a screen reader.
const SR_ONLY = {
  position: 'absolute', width: 1, height: 1, padding: 0, overflow: 'hidden',
  clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

function todayFormatted() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

function pathToTeamKey(pathname, validKeys) {
  const seg = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return validKeys.includes(seg) ? seg : null;
}

// Render backend prose that may contain <em> tags — the only markup the
// generator is allowed to emit. Text between the tags becomes real <em>
// elements; everything else renders as literal text, so model output can
// never inject HTML (no dangerouslySetInnerHTML).
function EmText({ text }) {
  if (!text) return null;
  const parts = text.split(/<em>(.*?)<\/em>/gs);
  return parts.map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : part));
}

// Section flag, in two weights. The main well gets the heavy flag (2px rule,
// 15px label); the rail gets a lighter one, so the sidebar reads as subordinate
// to the front page instead of claiming equal rank with it. Both take the same
// top margin, so the rail's opening rule registers against the well's across the
// vertical rule where the two columns start — the alignment a broadsheet lives on.
function SectionHead({ label, t, rail = false }) {
  return (
    <div style={{ marginTop: 40, marginBottom: rail ? 10 : 14 }}>
      <div style={{ height: rail ? 1 : 2, background: t.navy }} />
      <div style={{ paddingTop: rail ? 6 : 8, fontFamily: FRAUNCES, fontSize: rail ? 12 : 15, fontWeight: 900, letterSpacing: rail ? '0.18em' : '0.16em', textTransform: 'uppercase', color: t.navy, fontVariationSettings: "'opsz' 40" }}>
        {label}
      </div>
    </div>
  );
}

// The line score — innings across, R/H/E at the right. Away on top, home
// below, the way it has always been printed. Scoring innings are set in navy;
// the zeros recede to MUTED, so the shape of the game (a five-run third, a
// bullpen that held) reads at a glance instead of resolving into one number.
// A half-inning the home side never needed to bat prints "x", not a zero.
function LineScore({ ls, teamAbbr, oppAbbr, t, wide = false }) {
  if (!ls?.innings?.length) return null;

  const mine = { abbr: teamAbbr, isMine: true, ...ls.team, cells: ls.innings.map(i => i.team) };
  const theirs = { abbr: oppAbbr, isMine: false, ...ls.opponent, cells: ls.innings.map(i => i.opponent) };
  const rows = ls.teamIsHome ? [theirs, mine] : [mine, theirs];

  const head = {
    fontFamily: INTER, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
    color: t.teal, padding: '0 0 5px', textAlign: 'center', minWidth: 22,
  };
  const cell = {
    fontFamily: INTER, fontSize: 13, textAlign: 'center', padding: '5px 0',
    fontVariantNumeric: 'tabular-nums',
  };
  const total = {
    ...cell, fontFamily: FRAUNCES, fontSize: 15, fontWeight: 900, ...OPSZ9,
  };

  // The rule closes the header band across the whole page, but the table under it
  // is agate, not a banner: spread over 1,080px the innings lose their row, so in
  // the wide band it stops at 70% — the measure it had in the main well, and the
  // column the hairline above it already draws.
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${t.navy}`, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 300, maxWidth: wide ? '70%' : 'none' }}>
        <thead>
          <tr>
            <th scope="col" style={{ ...head, textAlign: 'left', minWidth: 42 }}><span style={SR_ONLY}>Team</span></th>
            {ls.innings.map(i => <th scope="col" key={i.num} style={head}>{i.num}</th>)}
            {['R', 'H', 'E'].map((h, i) => (
              <th scope="col" key={h} style={{ ...head, color: t.navy, borderLeft: i === 0 ? `1px solid ${t.navy}` : 'none', paddingLeft: i === 0 ? 8 : 0 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.abbr} style={{ borderTop: `1px solid ${PAPER2}` }}>
              <td style={{
                fontFamily: r.isMine ? FRAUNCES : INTER, fontSize: r.isMine ? 15 : 13,
                fontWeight: r.isMine ? 900 : 600, color: r.isMine ? t.navy : INK2,
                padding: '5px 0', whiteSpace: 'nowrap', ...(r.isMine ? OPSZ9 : {}),
              }}>
                {r.abbr}
              </td>
              {r.cells.map((runs, i) => (
                <td key={i} style={{
                  ...cell,
                  color: runs == null ? MUTED : runs > 0 ? t.navy : MUTED,
                  fontWeight: runs > 0 ? 700 : 400,
                }}>
                  {runs == null ? 'x' : runs}
                </td>
              ))}
              {[r.runs, r.hits, r.errors].map((v, i) => (
                <td key={i} style={{
                  ...total,
                  color: i === 0 ? t.navy : INK2,
                  fontSize: i === 0 ? 15 : 13,
                  fontFamily: i === 0 ? FRAUNCES : INTER,
                  fontWeight: i === 0 ? 900 : 400,
                  borderLeft: i === 0 ? `1px solid ${t.navy}` : 'none',
                  paddingLeft: i === 0 ? 8 : 0,
                }}>
                  {v ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// No section flag here: this is the front page, and the one block nobody needs
// labelled. The headline runs straight into the score.
//
// `wide` is the desktop header band, where the card runs the full page width
// instead of the main well's. Two panels stretched across 1,080px would strand
// a column of white space beside four short lines, so the meta splits in three:
// score, matchup, starter — each in its own measure, hairlines between.
function ScoreCard({ data, teamAbbr, t, wide = false }) {
  if (!data) return null;
  const starter = data.startingPitcher;
  const starterLabel = { color: t.teal, fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' };
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex' }}>
        <div style={{ flex: wide ? '0 0 32%' : '0 0 44%', paddingRight: 18, borderRight: `1px solid ${t.navy}` }}>
          <div style={{ fontFamily: FRAUNCES, fontSize: 54, fontWeight: 900, color: t.navy, lineHeight: 1, marginBottom: 6, ...OPSZ9 }}>
            {data.mScore}–{data.oScore}
          </div>
          <div style={{ fontSize: 13, color: INK2, marginBottom: 10 }}>{teamAbbr} vs. {data.oppAbbr}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: PAPER, background: data.won ? WIN_GREEN : WIN_RED, padding: '4px 10px 4px 8px' }}>
            {data.won ? (
              <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 6 L4.5 9 L10.5 2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            )}
            {data.won ? 'Win' : 'Loss'}
          </div>
        </div>
        <div style={{ flex: 1, padding: wide ? '0 18px' : '0 0 0 18px', borderRight: wide && starter ? `1px solid ${t.navy}` : 'none' }}>
          <div style={{ fontFamily: INTER, fontSize: 15, color: INK2, marginBottom: 10 }}>{data.oppName}</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 2 }}>
            <div>{data.venue}</div>
            <div>{data.gameDate}</div>
          </div>
          {starter && !wide && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${PAPER2}`, fontSize: 13, color: INK2 }}>
              <span style={starterLabel}>Starter: </span>
              {starter.name} · {starter.ip} IP · {starter.k} K · {starter.er} ER
            </div>
          )}
        </div>
        {wide && starter && (
          <div style={{ flex: '0 0 30%', paddingLeft: 18 }}>
            <div style={{ ...starterLabel, marginBottom: 8 }}>Starter</div>
            <div style={{ fontFamily: INTER, fontSize: 17, fontWeight: 700, color: t.navy, marginBottom: 4 }}>{starter.name}</div>
            <div style={{ fontSize: 13, color: INK2 }}>{starter.ip} IP · {starter.k} K · {starter.er} ER</div>
          </div>
        )}
      </div>
      <LineScore ls={data.lineScore} teamAbbr={teamAbbr} oppAbbr={data.oppAbbr} t={t} wide={wide} />
    </div>
  );
}

function NarrativeCard({ text, t, columns = false }) {
  if (!text) return null;
  // On desktop the recap flows in two newspaper columns with a hairline rule
  const columnStyle = columns
    ? { columnCount: 2, columnGap: 32, columnRule: `1px solid ${PAPER2}` }
    : {};
  return (
    <div>
      <SectionHead label="Recap" t={t} />
      <p style={{ fontFamily: INTER, fontSize: 17, lineHeight: 1.85, color: INK, textAlign: 'justify', hyphens: 'auto', ...columnStyle }}>
        <EmText text={text} />
      </p>
    </div>
  );
}

function OffenseCard({ players, t, columns = false }) {
  if (!players?.length) return null;
  // On desktop the card runs the full well width, so the batters flow in two
  // newspaper columns — same treatment as NarrativeCard. Each batter block is
  // kept whole so a name never splits from its stat boxes.
  const columnStyle = columns
    ? { columnCount: 2, columnGap: 32, columnRule: `1px solid ${PAPER2}` }
    : { display: 'flex', flexDirection: 'column' };
  return (
    <div>
      <SectionHead label="At the Plate" t={t} />
      <div style={columnStyle}>
        {players.map((p, i) => (
          <div key={p.name} style={{ breakInside: 'avoid', paddingBottom: 12, marginBottom: i < players.length - 1 ? 12 : 0, borderBottom: i < players.length - 1 ? `1px solid ${PAPER2}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: INTER, fontSize: 18, fontWeight: 700, color: t.navy }}>{p.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.teal, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{p.pos}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {p.stats.map(s => (
                  <div key={s.lbl} style={{ border: `1px solid ${t.navy}`, padding: '2px 7px', textAlign: 'center', minWidth: 32 }}>
                    <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: t.navy, lineHeight: 1.1 }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: t.teal, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
            {p.note && (
              <p style={{ fontFamily: INTER, fontSize: 14, lineHeight: 1.65, color: INK2, fontStyle: 'italic', margin: 0 }}>
                <EmText text={p.note} />
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// One compact row per pitch: name + velo, a thin usage bar (tick = season
// share), then game%/season%/delta/whiffs on one line. No per-pitch prose —
// the numbers carry it.
function PitchMixRow({ p, isLast, t }) {
  return (
    <div style={{ paddingBottom: 8, marginBottom: isLast ? 0 : 8, borderBottom: isLast ? 'none' : `1px solid ${PAPER2}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontFamily: INTER, fontSize: 14, fontWeight: 700, color: t.navy }}>{p.name}</span>
        {p.avgVelo != null && (
          <span style={{ fontSize: 12, color: MUTED, fontFamily: INTER, fontVariantNumeric: 'tabular-nums' }}>
            {p.avgVelo} mph avg{p.maxVelo != null && p.maxVelo > p.avgVelo ? ` · ${p.maxVelo} max` : ''}
          </span>
        )}
      </div>

      <div style={{ position: 'relative', height: 7, background: PAPER2, marginBottom: 4 }}>
        <div style={{ width: `${p.gamePct}%`, height: '100%', background: t.teal }} />
        {p.seasonPct != null && (
          <div style={{ position: 'absolute', top: -2, bottom: -2, left: `calc(${Math.min(p.seasonPct, 100)}% - 1px)`, width: 2, background: t.navy }} />
        )}
      </div>

      <div style={{ fontSize: 12, fontFamily: INTER, color: INK2, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontWeight: 700, color: t.navy }}>{p.gamePct}%</span> of pitches
        {p.seasonPct != null && (
          <>
            {' · '}season {p.seasonPct}%{' '}
            <span style={{ color: t.teal, fontWeight: 700 }}>
              {p.deltaPts > 0 ? `▲${p.deltaPts}` : p.deltaPts < 0 ? `▼${Math.abs(p.deltaPts)}` : '—'}
            </span>
          </>
        )}
        {p.whiffs > 0 && ` · ${p.whiffs} whiff${p.whiffs === 1 ? '' : 's'}`}
      </div>
    </div>
  );
}

function PitchingCard({ data, t, columns = false }) {
  const pitches = data?.arsenal?.pitches;
  if (!data || (!data.starter && !data.bullpen && !pitches?.length)) return null;
  const paragraph = {
    fontFamily: INTER, fontSize: 17, lineHeight: 1.85, color: INK,
    textAlign: 'justify', hyphens: 'auto', margin: 0,
  };
  // On desktop the card runs the full well width: prose and the arsenal rows
  // flow together in two newspaper columns, which balances the card's height
  // instead of leaving the neighbouring column short.
  const columnStyle = columns
    ? { columnCount: 2, columnGap: 32, columnRule: `1px solid ${PAPER2}` }
    : {};
  return (
    <div>
      <SectionHead label="Pitching" t={t} />
      <div style={columnStyle}>
        {data.starter && (
          <p style={{ ...paragraph, marginBottom: (pitches?.length || data.bullpen) ? 14 : 0 }}>
            <EmText text={data.starter} />
          </p>
        )}
        {pitches?.length > 0 && (
          <div style={{ marginBottom: data.bullpen ? 14 : 0 }}>
            {pitches.map((p, i) => (
              <PitchMixRow key={p.code} p={p} isLast={i === pitches.length - 1} t={t} />
            ))}
          </div>
        )}
        {data.bullpen && (
          <p style={paragraph}><EmText text={data.bullpen} /></p>
        )}
      </div>
    </div>
  );
}

// Archival-clipping treatment: hairline box on aged paper — double rules stay
// exclusive to zone banners.
function OnThisDayCard({ data, t, rail = false }) {
  if (!data) return null;
  const dateLabel = new Date(`2000-${data.monthDay}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric',
  });
  return (
    <div>
      <SectionHead label="On This Day" t={t} rail={rail} />
      <div style={{ background: PAPER2, border: `1px solid ${t.navy}`, padding: '16px 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.teal, fontFamily: INTER, marginBottom: 8 }}>
          {dateLabel}, {data.year}
        </div>
        <div style={{ fontFamily: FRAUNCES, fontSize: 22, fontWeight: 900, color: t.navy, lineHeight: 1.25, marginBottom: 10, ...OPSZ9 }}>
          {data.headline}
        </div>
        <p style={{ fontFamily: INTER, fontSize: 15, lineHeight: 1.8, color: INK, margin: 0 }}>{data.story}</p>
      </div>
    </div>
  );
}

function StatOfGameCard({ stat, t, columns = false }) {
  if (!stat) return null;
  // On desktop the card runs the full well width, so the body text flows in two
  // newspaper columns to keep the measure readable — same treatment as NarrativeCard.
  const columnStyle = columns
    ? { columnCount: 2, columnGap: 28, columnRule: '1px solid rgba(168,200,200,0.2)' }
    : {};
  return (
    <div>
      <SectionHead label="Stat of the Game" t={t} />
      <div style={{ background: t.navy, padding: '18px 20px' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
          {stat.abbr && (
            <span style={{ fontFamily: FRAUNCES, fontSize: 28, fontWeight: 900, color: PAPER, lineHeight: 1, ...OPSZ9 }}>
              {stat.abbr}
            </span>
          )}
          {stat.statName && (
            <span style={{ fontFamily: INTER, fontSize: 15, color: t.lteal }}>
              {stat.statName}
            </span>
          )}
        </div>

        {(stat.value || stat.player) && (
          <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(168,200,200,0.2)' }}>
            {stat.value && (
              <span style={{ fontFamily: FRAUNCES, fontSize: 36, fontWeight: 900, color: PAPER, lineHeight: 1, marginRight: 10, ...OPSZ9 }}>
                {stat.value}
              </span>
            )}
            {stat.player && (
              <span style={{ fontSize: 13, color: t.lteal, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {stat.player}
              </span>
            )}
          </div>
        )}

        <div style={columnStyle}>
          {stat.definition && (
            <p style={{ fontFamily: INTER, fontSize: 15, lineHeight: 1.8, color: LGREY, marginBottom: 10 }}>{stat.definition}</p>
          )}

          {stat.leagueContext && (
            <div style={{ borderLeft: `3px solid ${t.lteal}`, paddingLeft: 10, marginBottom: 10, breakInside: 'avoid' }}>
              <p style={{ fontFamily: INTER, fontSize: 14, lineHeight: 1.7, color: t.lteal, fontStyle: 'italic', margin: 0 }}>{stat.leagueContext}</p>
            </div>
          )}

          {stat.todayContext && (
            <p style={{ fontFamily: INTER, fontSize: 15, lineHeight: 1.8, color: LGREY, marginBottom: 0 }}>{stat.todayContext}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function YouTubeCard({ videoId, oppName, teamName, t }) {
  const query = `${teamName} ${oppName} highlights`;
  const fallbackUrl = `https://www.youtube.com/@MLB/search?query=${encodeURIComponent(query)}`;
  return (
    <div>
      <SectionHead label="Game Highlights" t={t} />
      <div style={{ border: `1px solid ${t.navy}` }}>
        {videoId ? (
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
              title="Game Highlights"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        ) : (
          <a href={fallbackUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', aspectRatio: '16/9', background: t.navy, textDecoration: 'none', gap: 10 }}>
            <div style={{ fontSize: 32, color: PAPER, opacity: 0.5 }}>▶</div>
            <div style={{ fontSize: 12, color: t.lteal, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Watch on MLB YouTube</div>
          </a>
        )}
        <div style={{ padding: '7px 12px', borderTop: `1px solid ${t.navy}`, fontSize: 12, color: MUTED, fontFamily: INTER, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Official MLB Highlights</span>
          {videoId && (
            <a href={`https://youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" style={{ color: t.teal, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>YouTube ↗</a>
          )}
        </div>
      </div>
    </div>
  );
}

// Tiny inline SVG line chart for a series of normalized values. `fluid` lets it
// span its container: the viewBox stretches horizontally while a non-scaling
// stroke keeps the line the same weight it would be at any other width.
function Sparkline({ data, color, width = 120, height = 24, fluid = false }) {
  if (!data || data.length < 2) return null;
  const vbW = fluid ? 300 : width;
  const probs = data.map(d => d.implied_prob);
  const min = Math.min(...probs);
  const max = Math.max(...probs);
  const range = max - min || 1;
  const points = probs
    .map((p, i) => {
      const x = (i / (probs.length - 1)) * (vbW - 2) + 1;
      const y = height - 1 - ((p - min) / range) * (height - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${vbW} ${height}`}
      width={fluid ? '100%' : vbW}
      height={height}
      preserveAspectRatio={fluid ? 'none' : 'xMidYMid meet'}
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// One standings section, two views. The tables and their data are unchanged —
// the tabs just decide which one is on the page. Wild card leads, because the
// race is the live question most days.
function StandingsCard({ rows, wildCardRows, divisionName, teamAbbr, t, rail = false }) {
  const hasDivision = !!rows?.length;
  const hasWildCard = !!wildCardRows?.length;
  const [tab, setTab] = useState('wildcard');
  if (!hasDivision && !hasWildCard) return null;

  // Never strand the reader on a tab with nothing behind it
  const active = (tab === 'wildcard' && hasWildCard) || !hasDivision ? 'wildcard' : 'division';
  const tabs = [
    ...(hasDivision ? [{ id: 'division', label: 'Division' }] : []),
    ...(hasWildCard ? [{ id: 'wildcard', label: 'Wild Card' }] : []),
  ];

  return (
    <div>
      <SectionHead label="Standings" t={t} rail={rail} />
      {tabs.length > 1 && (
        <div role="tablist" style={{ display: 'flex', gap: 20, borderBottom: `1px solid ${PAPER2}`, marginBottom: 12 }}>
          {tabs.map(tb => (
            <button
              key={tb.id}
              role="tab"
              aria-selected={active === tb.id}
              onClick={() => setTab(tb.id)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '0 0 8px', fontFamily: INTER, fontSize: 12, fontWeight: 700,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                // Inactive reads MUTED, not teal — teal means "label" everywhere
                // else on the page, so spending it on the unselected tab said
                // the opposite of what it meant.
                color: active === tb.id ? t.navy : MUTED,
                boxShadow: active === tb.id ? `inset 0 -2px 0 0 ${t.navy}` : 'none',
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>
      )}

      {active === 'division'
        ? <DivisionTable rows={rows} t={t} />
        : <WildCardTable rows={wildCardRows} divisionName={divisionName} teamAbbr={teamAbbr} t={t} />}
    </div>
  );
}

function DivisionTable({ rows, t }) {
  if (!rows?.length) return null;
  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${t.navy}` }}>
            {['', 'Team', 'W', 'L', 'GB'].map(h => (
              <th key={h} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: t.teal, padding: '4px 6px 7px', textAlign: (h === 'Team' || h === '') ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t2, i) => (
            <tr key={t2.name} style={{ borderBottom: `1px solid ${PAPER2}` }}>
              <td style={{ padding: '7px 6px', fontSize: 12, color: MUTED, width: 20 }}>{i + 1}</td>
              <td style={{ padding: '7px 6px', fontSize: 15, fontWeight: t2.isM ? 700 : 400, color: t2.isM ? t.navy : INK, fontFamily: t2.isM ? FRAUNCES : 'inherit', ...(t2.isM ? OPSZ9 : {}) }}>
                {t2.isM ? <span>▸ {t2.name}</span> : t2.name}
              </td>
              <td style={{ padding: '7px 6px', fontSize: 14, color: INK, textAlign: 'right', fontFamily: INTER }}>{t2.w}</td>
              <td style={{ padding: '7px 6px', fontSize: 14, color: INK2, textAlign: 'right', fontFamily: INTER }}>{t2.l}</td>
              <td style={{ padding: '7px 6px', fontSize: 13, color: MUTED, textAlign: 'right' }}>{i === 0 ? '—' : `+${t2.gb}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Form arrows for the wild card table. Direction lives in the shape, so the
// arrow still reads with colour stripped; intensity is carried three ways at
// once — the arrowhead grows, the ink deepens, and the steepest tier doubles
// the head — so a collapse looks like a collapse and a nudge looks like a
// nudge. The last-10 record rides alongside, because an arrow on its own is a
// mood and the point is to report a number.
const TREND_UP   = { 1: '#6E8F76', 2: '#3F7550', 3: '#245C3B' };
const TREND_DOWN = { 1: '#B08585', 2: '#A03A3A', 3: '#8B1A1A' };

function trendSummary({ wins, losses, games, streakType, streakNumber }) {
  const base = `${wins}-${losses} over their last ${games}`;
  if (!streakType || streakNumber < 2) return base;
  return `${base} · ${streakType === 'wins' ? 'won' : 'lost'} ${streakNumber} straight`;
}

// Compact streak token — "W5" / "L5" — rendered beside the record rather than
// hidden in a title tooltip, which never opens on touch. This is a phone-first
// paper; a run of five is the most interesting thing in the row and it was
// only reachable with a mouse.
function streakToken({ streakType, streakNumber }) {
  if (!streakType || streakNumber < 2) return null;
  return `${streakType === 'wins' ? 'W' : 'L'}${streakNumber}`;
}

function TrendGlyph({ trend }) {
  // No arrow at all when the sample is too thin to claim a direction
  if (!trend) return <span style={{ color: MUTED, fontSize: 12 }} aria-hidden="true">·</span>;

  const { tier, wins, losses } = trend;
  const label = trendSummary(trend);
  const streak = streakToken(trend);

  if (tier === 0) {
    return (
      <span title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
        <span aria-hidden="true" style={{ color: MUTED, fontSize: 12, lineHeight: 1 }}>–</span>
        <span style={{ fontSize: 11, color: MUTED, fontFamily: INTER }}>{wins}-{losses}</span>
        {streak && <span style={{ fontSize: 10, color: MUTED, fontFamily: INTER, fontWeight: 700 }}>{streak}</span>}
      </span>
    );
  }

  const up = tier > 0;
  const mag = Math.abs(tier);
  const colour = (up ? TREND_UP : TREND_DOWN)[mag];
  const steepest = mag === 3;
  const w = { 1: 7, 2: 9, 3: 9 }[mag];
  const h = w * 0.8;
  const gap = 3;
  const head = y => (up ? `${w / 2},${y} ${w},${y + h} 0,${y + h}` : `0,${y} ${w},${y} ${w / 2},${y + h}`);
  const boxH = steepest ? h * 2 + gap : h;

  return (
    <span title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      <svg width={w} height={boxH} viewBox={`0 0 ${w} ${boxH}`} role="img" aria-label={label}>
        <polygon points={head(0)} fill={colour} />
        {steepest && <polygon points={head(h + gap)} fill={colour} />}
      </svg>
      <span style={{ fontSize: 11, fontFamily: INTER, color: steepest ? colour : MUTED, fontWeight: steepest ? 700 : 400 }}>
        {wins}-{losses}
      </span>
      {streak && (
        <span style={{ fontSize: 10, fontFamily: INTER, color: colour, fontWeight: 700 }}>{streak}</span>
      )}
    </span>
  );
}

// The league's wild card race: the three teams holding spots with a cut line
// under them, the next two chasing, and — when our team is further back than
// that — its own row after a break.
function WildCardTable({ rows, divisionName, teamAbbr, t }) {
  if (!rows?.length) return null;

  const SPOTS = 3;
  const WINDOW = 5;
  const mine = rows.find(r => r.isM);
  const visible = rows.slice(0, WINDOW);
  const tail = mine && mine.rank > WINDOW ? mine : null;

  const cell = { padding: '7px 4px', fontSize: 14, textAlign: 'right', fontFamily: INTER };
  const row = r => (
    <tr key={r.name} style={{ borderBottom: `1px solid ${PAPER2}` }}>
      <td style={{ padding: '7px 4px', fontSize: 12, color: MUTED, width: 16 }}>{r.rank}</td>
      <td style={{ padding: '7px 4px', fontSize: 14, fontWeight: r.isM ? 700 : 400, color: r.isM ? t.navy : INK, fontFamily: r.isM ? FRAUNCES : 'inherit', ...(r.isM ? OPSZ9 : {}) }}>
        {r.isM ? <span>▸ {r.name}</span> : r.name}
      </td>
      <td style={{ padding: '7px 4px', textAlign: 'center' }}><TrendGlyph trend={r.trend} /></td>
      <td style={{ ...cell, color: INK }}>{r.w}</td>
      <td style={{ ...cell, color: INK2 }}>{r.l}</td>
      <td style={{ ...cell, fontSize: 13, color: MUTED, fontFamily: 'inherit' }}>{r.gb}</td>
    </tr>
  );

  return (
    <div>
      {!mine && (
        <div style={{ fontSize: 13, color: MUTED, marginTop: -4, marginBottom: 10, fontFamily: INTER }}>
          {teamAbbr} leads the {divisionName} — no wild card needed.
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${t.navy}` }}>
            {['', 'Team', 'L10', 'W', 'L', 'WCGB'].map(h => (
              <th key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.teal, padding: '4px 4px 7px', textAlign: (h === 'Team' || h === '') ? 'left' : h === 'L10' ? 'center' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map(r => (
            <Fragment key={r.name}>
              {row(r)}
              {r.rank === SPOTS && (visible.length > SPOTS || tail) && (
                <tr>
                  <td colSpan={6} style={{ padding: '3px 4px 5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.teal, fontFamily: INTER }}>Cut line</span>
                      <div style={{ flex: 1, height: 1, background: t.teal }} />
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {tail && (
            <>
              <tr>
                <td colSpan={6} style={{ padding: '2px 4px', fontSize: 12, color: MUTED, letterSpacing: '0.2em' }}>···</td>
              </tr>
              {row(tail)}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

// A market quote, not a schedule item: one number, its movement, and the line
// it came from. The teal bar is gone — it now means "aside" and nothing else —
// so this card carries its own shape instead: a hero figure with the sparkline
// running the full width beneath it, the way a paper prints a market table.
function TitleOddsCard({ data, trend, t, rail = false }) {
  if (!data) return null;
  const pct = (data.impliedProb * 100).toFixed(1);
  const oddsStr = data.medianOdds > 0 ? `+${data.medianOdds}` : String(data.medianOdds);
  const firstProb = trend?.[0]?.implied_prob;
  const last  = trend?.[trend.length - 1]?.implied_prob;
  const haveTrend = trend && trend.length >= 2 && firstProb != null && last != null;
  const deltaPp = haveTrend ? ((last - firstProb) * 100).toFixed(1) : null;
  const rising = haveTrend && Number(deltaPp) >= 0;
  const deltaSign = rising ? '+' : '';
  return (
    <div>
      <SectionHead label="WS Odds" t={t} rail={rail} />
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FRAUNCES, fontSize: 32, fontWeight: 900, color: t.navy, lineHeight: 1, ...OPSZ9 }}>{pct}%</span>
          <span style={{ fontSize: 13, color: INK2, fontFamily: INTER }}>to win the World Series</span>
        </div>
        {haveTrend && (
          <div style={{ marginTop: 10 }}>
            <Sparkline data={trend} color={t.navy} fluid height={28} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4, borderTop: `1px solid ${PAPER2}`, paddingTop: 5 }}>
              <span style={{ fontSize: 11, color: MUTED, fontFamily: INTER, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                Last {trend.length} days
              </span>
              <span style={{ fontSize: 12, color: rising ? WIN_GREEN : WIN_RED, fontWeight: 700, fontFamily: INTER, fontVariantNumeric: 'tabular-nums' }}>
                {deltaSign}{deltaPp} pp
              </span>
            </div>
          </div>
        )}
        <div style={{ fontSize: 13, color: MUTED, fontFamily: INTER, marginTop: 8 }}>
          <span style={{ color: t.teal, fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Median </span>
          <span style={{ color: t.navy, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{oddsStr}</span> · {data.bookmakerCount} US books
        </div>
      </div>
    </div>
  );
}

// Forward-looking, so it opens the way a dispatch does: a dateline first — day
// and first pitch, the two things you actually need — then the matchup, then
// who's throwing. No teal bar; the dateline is what marks it as ahead in time.
function NextGameCard({ data, teamAbbr, t, rail = false }) {
  if (!data) return null;
  const dayLabel = data.date
    ? new Date(`${data.date}T12:00:00Z`).toLocaleDateString('en-US', {
        timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric',
      })
    : null;
  const dateline = [dayLabel, data.time].filter(Boolean).join(' · ');
  return (
    <div>
      <SectionHead label="Next Game" t={t} rail={rail} />
      <div>
        {dateline && (
          <div style={{ fontFamily: INTER, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.teal, marginBottom: 6 }}>
            {dateline}
          </div>
        )}
        <div style={{ fontFamily: FRAUNCES, fontSize: 22, fontWeight: 900, color: t.navy, lineHeight: 1.15, marginBottom: 4, ...OPSZ9 }}>
          {teamAbbr} vs. {data.oppAbbr}
        </div>
        <div style={{ fontSize: 14, color: INK2, fontFamily: INTER, lineHeight: 1.6 }}>
          <div>{data.oppName}</div>
          <div style={{ color: MUTED, fontSize: 13 }}>{data.venue}</div>
        </div>
        {data.pitcher && (
          <div style={{ marginTop: 8, paddingTop: 7, borderTop: `1px solid ${PAPER2}`, fontSize: 13, color: INK2, fontFamily: INTER }}>
            <span style={{ color: t.teal, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Probable </span>
            {data.pitcher}
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonLine({ w = '100%', h = 11, mt = 8 }) {
  return <div className="skeleton" style={{ width: w, height: h, marginTop: mt }} />;
}

// The edition assembling itself, in the shape of the page that's coming —
// DESIGN.md always called for these; the `pulse` keyframe had been sitting in
// the stylesheet unused while a spinner stood in, saying nothing.
function LoadingEdition({ isDesktop }) {
  const header = (
    <>
      <SkeletonLine w="88%" h={isDesktop ? 44 : 30} mt={26} />
      <SkeletonLine w="58%" h={isDesktop ? 44 : 30} />
      <SkeletonLine w="34%" h={54} mt={22} />
    </>
  );
  const well = (
    <>
      <div style={{ height: 1, background: PAPER2, margin: isDesktop ? '40px 0 20px' : '20px 0' }} />
      <SkeletonLine mt={0} />
      <SkeletonLine />
      <SkeletonLine />
      <SkeletonLine w="71%" />
    </>
  );
  const rail = (
    <>
      <SkeletonLine w="44%" h={13} mt={isDesktop ? 40 : 26} />
      <SkeletonLine h={92} mt={12} />
      <SkeletonLine w="44%" h={13} mt={28} />
      <SkeletonLine h={66} mt={12} />
    </>
  );
  return (
    <div role="status">
      {header}
      {isDesktop ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px' }}>
          <div style={{ paddingRight: 36 }}>{well}</div>
          <div style={{ borderLeft: `1px solid ${PAPER2}`, paddingLeft: 36 }}>{rail}</div>
        </div>
      ) : well}
      <div style={{ textAlign: 'center', marginTop: 30, fontSize: 12, color: MUTED, fontFamily: INTER, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
        Compiling today's edition
      </div>
    </div>
  );
}

// A real dialog. Focus moves in on open, Tab is trapped, Escape closes, and
// focus returns to the button that opened it — `aria-modal` was asserting all
// of that before any of it was implemented. The frame carries the active
// edition's theme too: dropping to neutral ink at the moment you choose an
// edition was the one place the paper forgot which paper it was.
function EditionPicker({ teams, team, t, onSelect, onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = panelRef.current?.querySelectorAll('button');
      if (!items?.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault(); lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault(); firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose edition"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: PAPER, color: INK, overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 48, height: 48, background: 'transparent', border: 'none',
            cursor: 'pointer', fontSize: 26, lineHeight: 1, color: t.navy,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: INTER,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '4px 20px 64px' }}>
        <div style={{ height: 2, background: t.navy, marginBottom: 14 }} />
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.teal, textAlign: 'center', marginBottom: 6, fontFamily: INTER }}>
          Choose Edition
        </div>
        <h2 style={{ fontFamily: FRAUNCES, fontSize: 36, fontWeight: 900, color: t.navy, textAlign: 'center', lineHeight: 1, letterSpacing: '-0.5px', margin: '0 0 28px', ...OPSZ9 }}>
          Editions
        </h2>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {teams.map((tm, i) => {
            const selected = team === tm.key;
            return (
              <li key={tm.key}>
                <button
                  onClick={() => onSelect(tm.key)}
                  aria-current={selected ? 'true' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', minHeight: 64, padding: '14px 4px',
                    background: 'transparent', border: 'none',
                    borderTop: i === 0 ? `1px solid ${PAPER2}` : 'none',
                    borderBottom: `1px solid ${PAPER2}`,
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: INTER,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <span style={{ fontFamily: FRAUNCES, fontSize: 22, fontWeight: 900, color: tm.theme.navy, lineHeight: 1.1, ...OPSZ9 }}>
                      {tm.brandTitle}
                    </span>
                    <span style={{ fontSize: 12, color: MUTED, letterSpacing: '0.04em' }}>
                      {tm.edition}
                    </span>
                  </div>
                  <span style={{
                    flexShrink: 0, marginLeft: 12,
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: selected ? tm.theme.teal : 'transparent',
                  }}>
                    {selected ? '▸ Reading' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default function MsMinute() {
  const [teams, setTeams] = useState(null);
  const [team, setTeamState] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 900px)').matches);

  // Front-page grid kicks in at 900px; below that, the single-column edition
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const onChange = e => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Bootstrap: fetch the team registry, then derive initial team from the URL
  useEffect(() => {
    let cancelled = false;
    fetch('/api/teams')
      .then(r => r.json())
      .then(({ teams: list }) => {
        if (cancelled) return;
        setTeams(list);
        const validKeys = list.map(x => x.key);
        const fromPath = pathToTeamKey(window.location.pathname, validKeys);
        const stored = localStorage.getItem('teamKey');
        const initial =
          fromPath ??
          (validKeys.includes(stored) ? stored : null) ??
          validKeys[0];
        // If the URL didn't already specify a team, normalize it
        if (!fromPath) {
          window.history.replaceState({}, '', `/${initial}`);
        }
        setTeamState(initial);
      })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  // Browser back/forward
  useEffect(() => {
    if (!teams) return;
    const validKeys = teams.map(x => x.key);
    function onPop() {
      const k = pathToTeamKey(window.location.pathname, validKeys) ?? validKeys[0];
      setTeamState(k);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [teams]);

  // Fetch the report whenever the selected team changes
  useEffect(() => {
    if (!team) return;
    loadReport(team);
    localStorage.setItem('teamKey', team);
  }, [team]);

  // Stable identity: EditionPicker takes this in a useEffect dependency, and a
  // fresh arrow each render would tear down and rebuild the focus trap.
  const closePicker = useCallback(() => setPickerOpen(false), []);

  function selectTeam(nextKey) {
    if (nextKey === team) return;
    window.history.pushState({}, '', `/${nextKey}`);
    setTeamState(nextKey);
  }

  async function regenerateReport() {
    let token = localStorage.getItem('regenToken');
    if (!token) {
      token = window.prompt('Regen token:');
      if (!token) return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/regenerate?team=all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('regenToken');
        throw new Error('Invalid regen token');
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const body = await res.json();
      const failed = (body.results ?? []).filter(r => !r.ok);
      if (failed.length) {
        throw new Error(`Regen failed for: ${failed.map(f => `${f.team} (${f.error})`).join(', ')}`);
      }
      localStorage.setItem('regenToken', token);
      await loadReport(team);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function loadReport(selectedTeam) {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/report?team=${selectedTeam}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const report = await res.json();

      const sp = report.boxScore.startingPitcher;

      // Match a batter to their note tolerantly: strip any tags from the note's
      // name, try exact match, then fall back to last name — so a model that
      // wrote "Canzone" or "<em>Young</em>" still lands on the right player.
      const notes = report.playerNotes ?? [];
      const cleanName = (s) => (s ?? '').replace(/<[^>]+>/g, '').trim().toLowerCase();
      const noteFor = (batterName) => {
        const target = cleanName(batterName);
        const last = target.split(' ').pop();
        const hit =
          notes.find(n => cleanName(n.name) === target) ??
          notes.find(n => cleanName(n.name).split(' ').pop() === last);
        return hit?.note ?? '';
      };
      setData({
        teamId: report.teamId,
        teamName: report.teamName,
        teamAbbr: report.teamAbbr,
        divisionName: report.divisionName,
        gameData: {
          mScore: report.lastGame.teamScore,
          oScore: report.lastGame.opponentScore,
          oppAbbr: report.lastGame.opponentAbbr,
          oppName: report.lastGame.opponentName,
          venue: report.lastGame.venue,
          gameDate: formatDate(report.lastGame.date),
          won: report.lastGame.win,
          lineScore: report.lastGame.lineScore ?? null,
          startingPitcher: sp
            ? { name: sp.name, ip: sp.inningsPitched, k: sp.strikeOuts, er: sp.earnedRuns }
            : null,
        },
        headline: report.headline ?? null,
        narrative: report.narrative,
        offense: report.boxScore.offense.map(b => ({
          name: b.name,
          pos: b.position,
          note: noteFor(b.name),
          stats: [
            { val: `${b.hits}/${b.atBats}`, lbl: 'H/AB' },
            ...(b.homeRuns > 0 ? [{ val: b.homeRuns, lbl: 'HR' }] : []),
            ...(b.rbi > 0 ? [{ val: b.rbi, lbl: 'RBI' }] : []),
          ].slice(0, 3),
        })),
        pitching: report.pitching ?? null,
        onThisDay: report.onThisDay ?? null,
        statOfGame: report.statOfGame,
        titleOdds: report.titleOdds ?? null,
        titleOddsTrend: report.titleOddsTrend ?? [],
        standings: [...report.standings]
          .sort((a, b) => a.divisionRank - b.divisionRank)
          .map(row => ({
            name: row.team,
            isM: row.teamId === report.teamId,
            w: row.wins,
            l: row.losses,
            gb: row.gb,
          })),
        wildCard: (report.wildCard ?? []).map(row => ({
          name: row.team,
          isM: row.teamId === report.teamId,
          w: row.wins,
          l: row.losses,
          gb: row.gb,
          rank: row.wildCardRank,
          trend: row.trend ?? null,
        })),
        nextGame: report.nextGame
          ? {
              oppAbbr: report.nextGame.opponentAbbr,
              oppName: report.nextGame.opponentName,
              venue: report.nextGame.venue,
              date: report.nextGame.date,
              time: report.nextGame.gameTime,
              pitcher: report.nextGame.probablePitcher,
            }
          : null,
        ytVideoId: report.ytVideoId,
      });
    } catch (err) {
      // The reader gets plain language; the detail goes here, where it helps.
      console.error('[report] load failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Resolve the active team config (theme + branding). Fall back to a neutral
  // navy/teal until the registry has loaded so the masthead doesn't flash white.
  const teamConfig = teams?.find(x => x.key === team);
  const t = teamConfig?.theme ?? { navy: '#0C2340', teal: '#005C5C', lteal: '#A8C8C8' };
  const brandTitle = teamConfig?.brandTitle ?? "The M's Minute";
  const editionLabel = teamConfig?.edition ?? '';

  // Keep the tab title in sync with the active edition. Declared here, after
  // teamConfig exists — a dependency array referencing it above would read it
  // in the temporal dead zone and crash the first render.
  useEffect(() => {
    document.title = brandTitle;
  }, [brandTitle]);

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        em { color: ${t.navy}; font-style: normal; font-weight: 700; }
        a  { color: inherit; }

        /* The page shipped with no focus styles at all. One ring, everywhere. */
        :focus-visible { outline: 2px solid ${t.teal}; outline-offset: 2px; }

        /* Next Game and WS Odds pair up on phones, but under ~380px each column
           is too narrow for a 22px Fraunces matchup line — so they stack. */
        .pair-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 380px) { .pair-grid { grid-template-columns: 1fr; gap: 0; } }

        .skeleton { background: ${PAPER2}; animation: pulse 1.6s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      <div style={{ background: PAPER, minHeight: '100vh', color: INK }}>
        <div style={{ maxWidth: isDesktop ? 1140 : 520, margin: '0 auto', padding: isDesktop ? '0 28px 64px' : '0 20px 64px' }}>

          {/* Masthead */}
          <div style={{ paddingTop: 28 }}>
            <div style={{ height: 4, background: t.navy, marginBottom: 16 }} />
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <button
                onClick={() => teams && setPickerOpen(true)}
                disabled={!teams}
                style={{
                  minHeight: 44, fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: t.teal, borderTop: `1px solid ${t.teal}`, borderBottom: `1px solid ${t.teal}`,
                  borderLeft: 'none', borderRight: 'none', background: 'transparent',
                  padding: '12px 22px', display: 'inline-flex', alignItems: 'center', gap: 12,
                  cursor: teams ? 'pointer' : 'default', fontFamily: INTER,
                }}
                // Name the edition that's loaded, then the action. The bare
                // "Choose edition" overrode the visible text, so a screen
                // reader never learned which paper it was reading.
                aria-label={editionLabel ? `${editionLabel} edition — choose a different edition` : 'Choose edition'}
              >
                {editionLabel || ' '}
                {teams && (
                  <svg
                    aria-hidden="true"
                    width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ marginLeft: 4, flexShrink: 0 }}
                  >
                    <polyline points="6 9 12 16 18 9" />
                  </svg>
                )}
              </button>
            </div>
            <h1 style={{ fontFamily: FRAUNCES, fontSize: 'clamp(40px, 12vw, 64px)', fontWeight: 900, color: t.navy, textAlign: 'center', lineHeight: 1, letterSpacing: '-1px', margin: '0 0 10px', ...OPSZ9 }}>
              {brandTitle}
            </h1>
            <div style={{ textAlign: 'center', fontSize: 13, color: MUTED, fontFamily: INTER }}>
              {todayFormatted()}
            </div>
          </div>

          {/* Error — nothing loaded. Say what happened in the reader's terms and
              give them the one action worth taking; the raw fetch message goes
              to the console, where it's actually useful. */}
          {error && !data && (
            <div style={{ margin: '24px 0', padding: '18px', border: `1px solid ${WIN_RED}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: WIN_RED, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Today's edition hasn't been filed</div>
              <div style={{ fontSize: 15, color: INK2, lineHeight: 1.6, fontFamily: INTER }}>
                The paper posts by 5am Pacific. If it's later than that, the presses jammed — try again in a minute.
              </div>
              {import.meta.env.DEV && (
                <div style={{ marginTop: 10, fontSize: 12, color: MUTED, fontFamily: INTER }}>{error}</div>
              )}
              <button onClick={() => loadReport(team)} style={{ marginTop: 12, background: t.navy, color: PAPER, border: 'none', padding: '8px 16px', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>Try again</button>
            </div>
          )}

          {/* Loading — before any data arrives */}
          {loading && !data && !error && <LoadingEdition isDesktop={isDesktop} />}

          {/* Content */}
          {data && !isDesktop && (
            <>
              {data.headline && (
                <h2 style={{ fontFamily: FRAUNCES, fontSize: 'clamp(26px, 7.5vw, 34px)', fontWeight: 900, color: t.navy, lineHeight: 1.15, letterSpacing: '-0.5px', margin: '26px 0 2px', ...OPSZ9 }}>
                  {data.headline}
                </h2>
              )}
              <ScoreCard data={data.gameData} teamAbbr={data.teamAbbr} t={t} />
              <NarrativeCard text={data.narrative} t={t} />
              <OffenseCard players={data.offense} t={t} />
              <PitchingCard data={data.pitching} t={t} />
              <YouTubeCard videoId={data.ytVideoId} oppName={data.gameData.oppName} teamName={data.teamName} t={t} />
              <StatOfGameCard stat={data.statOfGame} t={t} />
              <OnThisDayCard data={data.onThisDay} t={t} />
              <StandingsCard rows={data.standings} wildCardRows={data.wildCard} divisionName={data.divisionName} teamAbbr={data.teamAbbr} t={t} />
              <div className="pair-grid">
                <NextGameCard data={data.nextGame} teamAbbr={data.teamAbbr} t={t} />
                <TitleOddsCard data={data.titleOdds} trend={data.titleOddsTrend} t={t} />
              </div>
            </>
          )}

          {/* Desktop: newspaper front page — full-width header band, then main
              well + rail. The lede and the score run clear across the page, the
              way a broadsheet banners its top story; the two columns open below
              them, so the rail's first flag sits level with Recap's. */}
          {data && isDesktop && (
            <>
              {data.headline && (
                <h2 style={{ fontFamily: FRAUNCES, fontSize: 46, fontWeight: 900, color: t.navy, lineHeight: 1.1, letterSpacing: '-0.5px', margin: '26px 0 2px', ...OPSZ9 }}>
                  {data.headline}
                </h2>
              )}
              <ScoreCard data={data.gameData} teamAbbr={data.teamAbbr} t={t} wide />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px' }}>
                <div style={{ paddingRight: 36 }}>
                  <NarrativeCard text={data.narrative} t={t} columns />
                  <OffenseCard players={data.offense} t={t} columns />
                  <PitchingCard data={data.pitching} t={t} columns />
                  <YouTubeCard videoId={data.ytVideoId} oppName={data.gameData.oppName} teamName={data.teamName} t={t} />
                  <StatOfGameCard stat={data.statOfGame} t={t} columns />
                </div>
                <aside style={{ borderLeft: `1px solid ${t.navy}`, paddingLeft: 36 }}>
                  <StandingsCard rows={data.standings} wildCardRows={data.wildCard} divisionName={data.divisionName} teamAbbr={data.teamAbbr} t={t} rail />
                  <NextGameCard data={data.nextGame} teamAbbr={data.teamAbbr} t={t} rail />
                  <TitleOddsCard data={data.titleOdds} trend={data.titleOddsTrend} t={t} rail />
                  <OnThisDayCard data={data.onThisDay} t={t} rail />
                </aside>
              </div>
            </>
          )}

          {/* Footer (both layouts) */}
          {data && (
            <>
              <div style={{ height: 2, background: t.navy, margin: '32px 0 12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: MUTED, fontFamily: INTER }}>MLB data · Claude AI</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {import.meta.env.DEV && (
                    <button onClick={regenerateReport} title="Bust cache and regenerate today's report" style={{ background: 'transparent', border: 'none', color: MUTED, padding: '5px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: INTER }}>Regenerate</button>
                  )}
                  <button onClick={() => loadReport(team)} style={{ background: 'transparent', border: `1px solid ${t.navy}`, color: t.navy, padding: '5px 12px', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>Refresh</button>
                </div>
              </div>
            </>
          )}

        </div>

        {pickerOpen && teams && (
          <EditionPicker
            teams={teams}
            team={team}
            t={t}
            onSelect={key => { selectTeam(key); setPickerOpen(false); }}
            onClose={closePicker}
          />
        )}
      </div>
    </>
  );
}
