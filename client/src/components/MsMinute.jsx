import { useState, useEffect } from 'react';

const PAPER   = '#F6F1E7';
const PAPER2  = '#EDE7D8';
const INK     = '#1A1A1A';
const INK2    = '#444444';
const MUTED   = '#5C5347';
const LGREY   = '#C8D4DC';
const WIN_RED = '#8B1A1A';

const THEMES = {
  mariners: {
    navy:  '#0C2340',
    teal:  '#005C5C',
    lteal: '#A8C8C8',
    title: "The M's Minute",
  },
  giants: {
    navy:  '#27251F',
    teal:  '#7B2D00',
    lteal: '#FD5A1E',
    title: "The G's Minute",
  },
};

const FRAUNCES = "'Fraunces', Georgia, serif";
const INTER    = "'Inter', system-ui, sans-serif";
const OPSZ9    = { fontVariationSettings: "'opsz' 9" };

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

function SectionHead({ label, t }) {
  return (
    <div style={{ marginTop: 28, marginBottom: 14 }}>
      <div style={{ height: 2, background: t.navy, marginBottom: 6 }} />
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.teal }}>
        {label}
      </div>
    </div>
  );
}

function ScoreCard({ data, teamAbbr, t }) {
  if (!data) return null;
  return (
    <div>
      <SectionHead label="Last Game" t={t} />
      <div style={{ display: 'flex' }}>
        <div style={{ flex: '0 0 44%', paddingRight: 18, borderRight: `1px solid ${t.navy}` }}>
          <div style={{ fontFamily: FRAUNCES, fontSize: 54, fontWeight: 900, color: t.navy, lineHeight: 1, marginBottom: 6, ...OPSZ9 }}>
            {data.mScore}–{data.oScore}
          </div>
          <div style={{ fontSize: 11, color: INK2, marginBottom: 10 }}>{teamAbbr} vs. {data.oppAbbr}</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: data.won ? t.teal : WIN_RED, borderBottom: `2px solid ${data.won ? t.teal : WIN_RED}`, display: 'inline-block', paddingBottom: 1 }}>
            {data.won ? 'Win' : 'Loss'}
          </div>
        </div>
        <div style={{ flex: 1, paddingLeft: 18 }}>
          <div style={{ fontFamily: INTER, fontSize: 15, fontStyle: 'italic', color: INK2, marginBottom: 10 }}>{data.oppName}</div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 2 }}>
            <div>{data.venue}</div>
            <div>{data.gameDate}</div>
          </div>
          {data.startingPitcher && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${PAPER2}`, fontSize: 11, color: INK2 }}>
              <span style={{ color: t.teal, fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Starter: </span>
              {data.startingPitcher.name} · {data.startingPitcher.ip} IP · {data.startingPitcher.k} K · {data.startingPitcher.er} ER
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NarrativeCard({ text, t }) {
  if (!text) return null;
  return (
    <div>
      <SectionHead label="Recap" t={t} />
      <p
        style={{ fontFamily: INTER, fontSize: 17, lineHeight: 1.85, color: INK, fontStyle: 'italic', textAlign: 'justify', hyphens: 'auto' }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
}

function OffenseCard({ players, t }) {
  if (!players?.length) return null;
  return (
    <div>
      <SectionHead label="At the Plate" t={t} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {players.map((p, i) => (
          <div key={p.name} style={{ paddingTop: i === 0 ? 0 : 12, paddingBottom: 12, borderBottom: i < players.length - 1 ? `1px solid ${PAPER2}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: FRAUNCES, fontSize: 18, fontWeight: 900, color: t.navy, ...OPSZ9 }}>{p.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{p.pos}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {p.stats.map(s => (
                  <div key={s.lbl} style={{ border: `1px solid ${t.navy}`, padding: '2px 7px', textAlign: 'center', minWidth: 32 }}>
                    <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: t.navy, lineHeight: 1.1 }}>{s.val}</div>
                    <div style={{ fontSize: 8, color: t.teal, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
            {p.note && <p style={{ fontFamily: INTER, fontSize: 14, lineHeight: 1.65, color: INK2, fontStyle: 'italic', margin: 0 }}>{p.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatOfGameCard({ stat, t }) {
  if (!stat) return null;
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
            <span style={{ fontFamily: INTER, fontSize: 15, fontStyle: 'italic', color: t.lteal }}>
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
              <span style={{ fontSize: 12, color: t.lteal, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {stat.player}
              </span>
            )}
          </div>
        )}

        {stat.definition && (
          <p style={{ fontFamily: INTER, fontSize: 15, lineHeight: 1.8, color: LGREY, marginBottom: 10 }}>{stat.definition}</p>
        )}

        {stat.leagueContext && (
          <div style={{ borderLeft: `3px solid ${t.lteal}`, paddingLeft: 10, marginBottom: 10 }}>
            <p style={{ fontFamily: INTER, fontSize: 14, lineHeight: 1.7, color: t.lteal, fontStyle: 'italic', margin: 0 }}>{stat.leagueContext}</p>
          </div>
        )}

        {stat.todayContext && (
          <p style={{ fontFamily: INTER, fontSize: 15, lineHeight: 1.8, color: LGREY, marginBottom: 0 }}>{stat.todayContext}</p>
        )}
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
            <div style={{ fontSize: 11, color: t.lteal, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Watch on MLB YouTube</div>
          </a>
        )}
        <div style={{ padding: '7px 12px', borderTop: `1px solid ${t.navy}`, fontSize: 11, color: MUTED, fontStyle: 'italic', fontFamily: INTER, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Official MLB Highlights</span>
          {videoId && (
            <a href={`https://youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" style={{ color: t.teal, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>YouTube ↗</a>
          )}
        </div>
      </div>
    </div>
  );
}

function StandingsCard({ rows, divisionName, t }) {
  if (!rows?.length) return null;
  return (
    <div>
      <SectionHead label={`${divisionName} Standings`} t={t} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${t.navy}` }}>
            {['', 'Team', 'W', 'L', 'GB'].map(h => (
              <th key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: t.teal, padding: '4px 6px 7px', textAlign: (h === 'Team' || h === '') ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t2, i) => (
            <tr key={t2.name} style={{ borderBottom: `1px solid ${PAPER2}` }}>
              <td style={{ padding: '7px 6px', fontSize: 11, color: MUTED, width: 20 }}>{i + 1}</td>
              <td style={{ padding: '7px 6px', fontSize: 15, fontWeight: t2.isM ? 700 : 400, color: t2.isM ? t.navy : INK, fontFamily: t2.isM ? FRAUNCES : 'inherit', ...(t2.isM ? OPSZ9 : {}) }}>
                {t2.isM ? <span>▸ {t2.name}</span> : t2.name}
              </td>
              <td style={{ padding: '7px 6px', fontSize: 14, color: INK, textAlign: 'right', fontFamily: INTER }}>{t2.w}</td>
              <td style={{ padding: '7px 6px', fontSize: 14, color: INK2, textAlign: 'right', fontFamily: INTER }}>{t2.l}</td>
              <td style={{ padding: '7px 6px', fontSize: 12, color: MUTED, textAlign: 'right' }}>{i === 0 ? '—' : `+${t2.gb}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NextGameCard({ data, teamAbbr, t }) {
  if (!data) return null;
  return (
    <div>
      <SectionHead label="Next Game" t={t} />
      <div style={{ borderLeft: `3px solid ${t.teal}`, paddingLeft: 14 }}>
        <div style={{ fontFamily: FRAUNCES, fontSize: 22, fontWeight: 900, color: t.navy, marginBottom: 6, ...OPSZ9 }}>{teamAbbr} vs. {data.oppAbbr}</div>
        <div style={{ fontSize: 14, color: INK2, lineHeight: 1.9, fontFamily: INTER }}>
          <div style={{ fontStyle: 'italic' }}>{data.oppName}</div>
          <div>{data.venue}</div>
          <div><span style={{ color: t.teal, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>First pitch: </span>{data.time}</div>
          {data.pitcher && <div><span style={{ color: t.teal, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Probable: </span>{data.pitcher}</div>}
        </div>
      </div>
    </div>
  );
}

function Skeleton({ height = 16, width = '100%', style = {} }) {
  return (
    <div style={{
      height, width, background: PAPER2, borderRadius: 2,
      animation: 'pulse 1.5s ease-in-out infinite', ...style,
    }} />
  );
}

function SectionSkeleton({ lines = 3 }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ height: 2, background: PAPER2, marginBottom: 6 }} />
      <Skeleton height={10} width={80} style={{ marginBottom: 14 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={15} width={i === lines - 1 ? '65%' : '100%'} style={{ marginBottom: 8 }} />
      ))}
    </div>
  );
}

export default function MsMinute() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [team, setTeam] = useState('mariners');

  const t = THEMES[team];

  useEffect(() => { loadReport(team); }, [team]);

  async function loadReport(selectedTeam) {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/report?team=${selectedTeam}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const report = await res.json();

      const sp = report.boxScore.startingPitcher;
      setData({
        teamId: report.teamId,
        teamName: report.teamName,
        teamAbbr: report.teamAbbr,
        divisionName: report.divisionName,
        gameData: {
          mScore: report.lastGame.marinersScore,
          oScore: report.lastGame.opponentScore,
          oppAbbr: report.lastGame.opponentAbbr,
          oppName: report.lastGame.opponentName,
          venue: report.lastGame.venue,
          gameDate: formatDate(report.lastGame.date),
          won: report.lastGame.win,
          startingPitcher: sp
            ? { name: sp.name, ip: sp.inningsPitched, k: sp.strikeOuts, er: sp.earnedRuns }
            : null,
        },
        narrative: report.narrative,
        offense: report.boxScore.offense.map(b => ({
          name: b.name,
          pos: b.position,
          note: report.playerNotes.find(n => n.name === b.name)?.note ?? '',
          stats: [
            { val: `${b.hits}/${b.atBats}`, lbl: 'H/AB' },
            ...(b.homeRuns > 0 ? [{ val: b.homeRuns, lbl: 'HR' }] : []),
            ...(b.rbi > 0 ? [{ val: b.rbi, lbl: 'RBI' }] : []),
          ].slice(0, 3),
        })),
        statOfGame: report.statOfGame,
        standings: [...report.standings]
          .sort((a, b) => a.divisionRank - b.divisionRank)
          .map(row => ({
            name: row.team,
            isM: row.teamId === report.teamId,
            w: row.wins,
            l: row.losses,
            gb: row.gb,
          })),
        nextGame: report.nextGame
          ? {
              oppAbbr: report.nextGame.opponentAbbr,
              oppName: report.nextGame.opponentName,
              venue: report.nextGame.venue,
              time: report.nextGame.gameTime,
              pitcher: report.nextGame.probablePitcher,
            }
          : null,
        ytVideoId: report.ytVideoId,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,900;1,9..144,400&family=Inter:ital,wght@0,400;0,600;0,700;1,400&display=swap');
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        em { color: ${t.teal}; font-style: normal; font-weight: 700; }
        a  { color: inherit; }
      `}</style>

      <div style={{ background: PAPER, minHeight: '100vh', color: INK }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 20px 64px' }}>

          {/* Masthead */}
          <div style={{ paddingTop: 28 }}>
            <div style={{ height: 4, background: t.navy, marginBottom: 16 }} />
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.teal, borderTop: `1px solid ${t.teal}`, borderBottom: `1px solid ${t.teal}`, padding: '3px 14px', display: 'inline-block' }}>
                {team === 'mariners' ? 'Seattle Mariners' : 'San Francisco Giants'} · Daily Edition
              </span>
            </div>
            <h1 style={{ fontFamily: FRAUNCES, fontSize: 'clamp(40px, 12vw, 64px)', fontWeight: 900, color: t.navy, textAlign: 'center', lineHeight: 1, letterSpacing: '-1px', margin: '0 0 10px', ...OPSZ9 }}>
              {t.title}
            </h1>
            <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, fontStyle: 'italic', fontFamily: INTER }}>
              {todayFormatted()}
            </div>
          </div>

          {/* Error — nothing loaded */}
          {error && !data && (
            <div style={{ margin: '24px 0', padding: '18px', border: `1px solid ${WIN_RED}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: WIN_RED, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Edition Unavailable</div>
              <div style={{ fontSize: 15, color: INK2, lineHeight: 1.6, fontFamily: INTER, fontStyle: 'italic' }}>{error}</div>
              <button onClick={loadReport} style={{ marginTop: 12, background: t.navy, color: PAPER, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>Retry</button>
            </div>
          )}

          {/* Loading spinner — before any data arrives */}
          {loading && !data && (
            <div style={{ textAlign: 'center', padding: '52px 0' }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${PAPER2}`, borderTopColor: t.teal, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
              <div style={{ fontSize: 14, color: MUTED, fontStyle: 'italic', fontFamily: INTER }}>Compiling today's edition…</div>
            </div>
          )}

          {/* Content */}
          {data && (
            <>
              <ScoreCard data={data.gameData} teamAbbr={data.teamAbbr} t={t} />
              <NarrativeCard text={data.narrative} t={t} />
              <OffenseCard players={data.offense} t={t} />
              <StatOfGameCard stat={data.statOfGame} t={t} />
              <YouTubeCard videoId={data.ytVideoId} oppName={data.gameData.oppName} teamName={data.teamName} t={t} />
              <StandingsCard rows={data.standings} divisionName={data.divisionName} t={t} />
              <NextGameCard data={data.nextGame} teamAbbr={data.teamAbbr} t={t} />

              <div style={{ height: 2, background: t.navy, margin: '32px 0 12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, color: MUTED, fontStyle: 'italic', fontFamily: INTER }}>MLB data · Claude AI</div>
                <button onClick={() => loadReport(team)} style={{ background: 'transparent', border: `1px solid ${t.navy}`, color: t.navy, padding: '5px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>Refresh</button>
              </div>
            </>
          )}

          {/* Team toggle — always in footer */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: data ? 16 : 52, paddingBottom: 8 }}>
            <div style={{ display: 'inline-flex', border: `1px solid ${t.navy}` }}>
              {[{ key: 'mariners', label: 'SEA' }, { key: 'giants', label: 'SF' }].map(({ key, label }, i) => (
                <button
                  key={key}
                  onClick={() => setTeam(key)}
                  style={{
                    background: team === key ? t.navy : 'transparent',
                    color: team === key ? PAPER : t.navy,
                    border: 'none',
                    borderLeft: i > 0 ? `1px solid ${t.navy}` : 'none',
                    padding: '4px 16px',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: INTER,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
