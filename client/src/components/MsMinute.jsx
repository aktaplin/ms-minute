import { useState, useEffect } from 'react';

const PAPER   = '#F6F1E7';
const PAPER2  = '#EDE7D8';
const NAVY    = '#0C2340';
const TEAL    = '#005C5C';
const INK     = '#1A1A1A';
const INK2    = '#444444';
const MUTED   = '#5C5347';
const LTEAL   = '#A8C8C8';
const LGREY   = '#C8D4DC';
const WIN_RED = '#8B1A1A';

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

function SectionHead({ label }) {
  return (
    <div style={{ marginTop: 28, marginBottom: 14 }}>
      <div style={{ height: 2, background: NAVY, marginBottom: 6 }} />
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: TEAL }}>
        {label}
      </div>
    </div>
  );
}

function ScoreCard({ data }) {
  if (!data) return null;
  return (
    <div>
      <SectionHead label="Last Game" />
      <div style={{ display: 'flex' }}>
        <div style={{ flex: '0 0 44%', paddingRight: 18, borderRight: `1px solid ${NAVY}` }}>
          <div style={{ fontFamily: FRAUNCES, fontSize: 54, fontWeight: 900, color: NAVY, lineHeight: 1, marginBottom: 6, ...OPSZ9 }}>
            {data.mScore}–{data.oScore}
          </div>
          <div style={{ fontSize: 10, color: INK2, marginBottom: 10 }}>SEA vs. {data.oppAbbr}</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: data.won ? TEAL : WIN_RED, borderBottom: `2px solid ${data.won ? TEAL : WIN_RED}`, display: 'inline-block', paddingBottom: 1 }}>
            {data.won ? 'Win' : 'Loss'}
          </div>
        </div>
        <div style={{ flex: 1, paddingLeft: 18 }}>
          <div style={{ fontFamily: INTER, fontSize: 13, fontStyle: 'italic', color: INK2, marginBottom: 10 }}>{data.oppName}</div>
          <div style={{ fontSize: 11, color: MUTED, lineHeight: 2 }}>
            <div>{data.venue}</div>
            <div>{data.gameDate}</div>
          </div>
          {data.startingPitcher && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${PAPER2}`, fontSize: 10, color: INK2 }}>
              <span style={{ color: TEAL, fontWeight: 700, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Starter: </span>
              {data.startingPitcher.name} · {data.startingPitcher.ip} IP · {data.startingPitcher.k} K · {data.startingPitcher.er} ER
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NarrativeCard({ text }) {
  if (!text) return null;
  return (
    <div>
      <SectionHead label="Recap" />
      <p
        style={{ fontFamily: INTER, fontSize: 15, lineHeight: 1.85, color: INK, fontStyle: 'italic', textAlign: 'justify', hyphens: 'auto' }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
}

function OffenseCard({ players }) {
  if (!players?.length) return null;
  return (
    <div>
      <SectionHead label="At the Plate" />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {players.map((p, i) => (
          <div key={p.name} style={{ paddingTop: i === 0 ? 0 : 12, paddingBottom: 12, borderBottom: i < players.length - 1 ? `1px solid ${PAPER2}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: FRAUNCES, fontSize: 16, fontWeight: 900, color: NAVY, ...OPSZ9 }}>{p.name}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: TEAL, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{p.pos}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {p.stats.map(s => (
                  <div key={s.lbl} style={{ border: `1px solid ${NAVY}`, padding: '2px 7px', textAlign: 'center', minWidth: 32 }}>
                    <div style={{ fontFamily: INTER, fontSize: 13, fontWeight: 700, color: NAVY, lineHeight: 1.1 }}>{s.val}</div>
                    <div style={{ fontSize: 7, color: TEAL, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
            {p.note && <p style={{ fontFamily: INTER, fontSize: 12, lineHeight: 1.65, color: INK2, fontStyle: 'italic', margin: 0 }}>{p.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatOfGameCard({ stat }) {
  if (!stat) return null;
  return (
    <div>
      <SectionHead label="Stat of the Game" />
      <div style={{ background: NAVY, padding: '18px 20px' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
          {stat.abbr && (
            <span style={{ fontFamily: FRAUNCES, fontSize: 28, fontWeight: 900, color: PAPER, lineHeight: 1, ...OPSZ9 }}>
              {stat.abbr}
            </span>
          )}
          {stat.statName && (
            <span style={{ fontFamily: INTER, fontSize: 13, fontStyle: 'italic', color: LTEAL }}>
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
              <span style={{ fontSize: 11, color: LTEAL, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {stat.player}
              </span>
            )}
          </div>
        )}

        {stat.definition && (
          <p style={{ fontFamily: INTER, fontSize: 13, lineHeight: 1.8, color: LGREY, marginBottom: 10 }}>{stat.definition}</p>
        )}

        {stat.leagueContext && (
          <div style={{ borderLeft: `3px solid ${LTEAL}`, paddingLeft: 10, marginBottom: 10 }}>
            <p style={{ fontFamily: INTER, fontSize: 12, lineHeight: 1.7, color: LTEAL, fontStyle: 'italic', margin: 0 }}>{stat.leagueContext}</p>
          </div>
        )}

        {stat.todayContext && (
          <p style={{ fontFamily: INTER, fontSize: 13, lineHeight: 1.8, color: LGREY, marginBottom: 0 }}>{stat.todayContext}</p>
        )}
      </div>
    </div>
  );
}

function YouTubeCard({ videoId, oppName }) {
  const query = `Seattle Mariners ${oppName} highlights`;
  const fallbackUrl = `https://www.youtube.com/@MLB/search?query=${encodeURIComponent(query)}`;
  return (
    <div>
      <SectionHead label="Game Highlights" />
      <div style={{ border: `1px solid ${NAVY}` }}>
        {videoId ? (
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
              title="Mariners Game Highlights"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        ) : (
          <a href={fallbackUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', aspectRatio: '16/9', background: NAVY, textDecoration: 'none', gap: 10 }}>
            <div style={{ fontSize: 32, color: PAPER, opacity: 0.5 }}>▶</div>
            <div style={{ fontSize: 10, color: LTEAL, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Watch on MLB YouTube</div>
          </a>
        )}
        <div style={{ padding: '7px 12px', borderTop: `1px solid ${NAVY}`, fontSize: 10, color: MUTED, fontStyle: 'italic', fontFamily: INTER, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Official MLB Highlights</span>
          {videoId && (
            <a href={`https://youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" style={{ color: TEAL, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>YouTube ↗</a>
          )}
        </div>
      </div>
    </div>
  );
}

function StandingsCard({ rows }) {
  if (!rows?.length) return null;
  return (
    <div>
      <SectionHead label="AL West Standings" />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${NAVY}` }}>
            {['', 'Team', 'W', 'L', 'GB'].map(h => (
              <th key={h} style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: TEAL, padding: '4px 6px 7px', textAlign: (h === 'Team' || h === '') ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.name} style={{ borderBottom: `1px solid ${PAPER2}` }}>
              <td style={{ padding: '7px 6px', fontSize: 10, color: MUTED, width: 20 }}>{i + 1}</td>
              <td style={{ padding: '7px 6px', fontSize: 13, fontWeight: t.isM ? 700 : 400, color: t.isM ? NAVY : INK, fontFamily: t.isM ? FRAUNCES : 'inherit', ...(t.isM ? OPSZ9 : {}) }}>
                {t.isM ? <span>▸ {t.name}</span> : t.name}
              </td>
              <td style={{ padding: '7px 6px', fontSize: 12, color: INK, textAlign: 'right', fontFamily: INTER }}>{t.w}</td>
              <td style={{ padding: '7px 6px', fontSize: 12, color: INK2, textAlign: 'right', fontFamily: INTER }}>{t.l}</td>
              <td style={{ padding: '7px 6px', fontSize: 11, color: MUTED, textAlign: 'right' }}>{i === 0 ? '—' : `+${t.gb}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NextGameCard({ data }) {
  if (!data) return null;
  return (
    <div>
      <SectionHead label="Next Game" />
      <div style={{ borderLeft: `3px solid ${TEAL}`, paddingLeft: 14 }}>
        <div style={{ fontFamily: FRAUNCES, fontSize: 20, fontWeight: 900, color: NAVY, marginBottom: 6, ...OPSZ9 }}>SEA vs. {data.oppAbbr}</div>
        <div style={{ fontSize: 12, color: INK2, lineHeight: 1.9, fontFamily: INTER }}>
          <div style={{ fontStyle: 'italic' }}>{data.oppName}</div>
          <div>{data.venue}</div>
          <div><span style={{ color: TEAL, fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>First pitch: </span>{data.time}</div>
          {data.pitcher && <div><span style={{ color: TEAL, fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>M's probable: </span>{data.pitcher}</div>}
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
      <Skeleton height={9} width={80} style={{ marginBottom: 14 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={13} width={i === lines - 1 ? '65%' : '100%'} style={{ marginBottom: 8 }} />
      ))}
    </div>
  );
}

export default function MsMinute() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { loadReport(); }, []);

  async function loadReport() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch('/api/report');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const report = await res.json();

      const sp = report.boxScore.startingPitcher;
      setData({
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
          .map(t => ({
            name: t.team,
            isM: t.teamId === 136,
            w: t.wins,
            l: t.losses,
            gb: t.gb,
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
        em { color: #005C5C; font-style: normal; font-weight: 700; }
        a  { color: inherit; }
      `}</style>

      <div style={{ background: PAPER, minHeight: '100vh', color: INK }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 20px 64px' }}>

          {/* Masthead */}
          <div style={{ paddingTop: 28 }}>
            <div style={{ height: 4, background: NAVY, marginBottom: 16 }} />
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: TEAL, borderTop: `1px solid ${TEAL}`, borderBottom: `1px solid ${TEAL}`, padding: '3px 14px', display: 'inline-block' }}>
                Seattle Mariners · Daily Edition
              </span>
            </div>
            <h1 style={{ fontFamily: FRAUNCES, fontSize: 'clamp(40px, 12vw, 64px)', fontWeight: 900, color: NAVY, textAlign: 'center', lineHeight: 1, letterSpacing: '-1px', margin: '0 0 10px', ...OPSZ9 }}>
              The M's Minute
            </h1>
            <div style={{ textAlign: 'center', fontSize: 11, color: MUTED, fontStyle: 'italic', fontFamily: INTER }}>
              {todayFormatted()}
            </div>
          </div>

          {/* Error — nothing loaded */}
          {error && !data && (
            <div style={{ margin: '24px 0', padding: '18px', border: `1px solid ${WIN_RED}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: WIN_RED, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Edition Unavailable</div>
              <div style={{ fontSize: 13, color: INK2, lineHeight: 1.6, fontFamily: INTER, fontStyle: 'italic' }}>{error}</div>
              <button onClick={loadReport} style={{ marginTop: 12, background: NAVY, color: PAPER, border: 'none', padding: '8px 16px', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>Retry</button>
            </div>
          )}

          {/* Loading spinner — before any data arrives */}
          {loading && !data && (
            <div style={{ textAlign: 'center', padding: '52px 0' }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${PAPER2}`, borderTopColor: TEAL, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
              <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', fontFamily: INTER }}>Compiling today's edition…</div>
            </div>
          )}

          {/* Content */}
          {data && (
            <>
              <ScoreCard data={data.gameData} />
              <NarrativeCard text={data.narrative} />
              <OffenseCard players={data.offense} />
              <StatOfGameCard stat={data.statOfGame} />
              <YouTubeCard videoId={data.ytVideoId} oppName={data.gameData.oppName} />
              <StandingsCard rows={data.standings} />
              <NextGameCard data={data.nextGame} />

              <div style={{ height: 2, background: NAVY, margin: '32px 0 12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: MUTED, fontStyle: 'italic', fontFamily: INTER }}>MLB data · Claude AI</div>
                <button onClick={loadReport} style={{ background: 'transparent', border: `1px solid ${NAVY}`, color: NAVY, padding: '5px 12px', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>Refresh</button>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
