import { Fragment, useState, useEffect } from 'react';

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

function SectionHead({ label, t }) {
  return (
    <div style={{ marginTop: 28, marginBottom: 14 }}>
      <div style={{ height: 2, background: t.navy, marginBottom: 6 }} />
      <div style={{ fontFamily: FRAUNCES, fontSize: 15, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.teal, fontVariationSettings: "'opsz' 40" }}>
        {label}
      </div>
    </div>
  );
}

// Newspaper section flag: double rule + centered "Section A · The Game" label
function ZoneBanner({ kicker, label, t }) {
  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ height: 3, background: t.navy }} />
      <div style={{ height: 1, background: t.navy, marginTop: 2 }} />
      <div style={{ textAlign: 'center', paddingTop: 10, fontFamily: FRAUNCES, fontSize: 13, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.navy, fontVariationSettings: "'opsz' 40" }}>
        <span style={{ color: t.teal }}>{kicker}</span>
        <span style={{ margin: '0 8px', color: MUTED }}>·</span>
        {label}
      </div>
    </div>
  );
}

// Sticky section index under the masthead; jump-scrolls to each zone
function SectionNav({ zones, active, onJump, t }) {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: PAPER, borderBottom: `1px solid ${t.navy}`, margin: '18px -20px 0', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: 4 }}>
        {zones.map((z, i) => (
          <Fragment key={z.id}>
            {i > 0 && <span aria-hidden="true" style={{ alignSelf: 'center', color: t.teal, fontSize: 12 }}>·</span>}
            <button
              onClick={() => onJump(z.id)}
              aria-current={active === z.id ? 'true' : undefined}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '13px 10px', fontFamily: INTER, fontSize: 12, fontWeight: 700,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                color: active === z.id ? t.navy : t.teal,
                boxShadow: active === z.id ? `inset 0 -2px 0 0 ${t.navy}` : 'none',
              }}
            >
              {z.label}
            </button>
          </Fragment>
        ))}
      </div>
    </nav>
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
        <div style={{ flex: 1, paddingLeft: 18 }}>
          <div style={{ fontFamily: INTER, fontSize: 15, fontStyle: 'italic', color: INK2, marginBottom: 10 }}>{data.oppName}</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 2 }}>
            <div>{data.venue}</div>
            <div>{data.gameDate}</div>
          </div>
          {data.startingPitcher && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${PAPER2}`, fontSize: 13, color: INK2 }}>
              <span style={{ color: t.teal, fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Starter: </span>
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
            {p.note && <p style={{ fontFamily: INTER, fontSize: 14, lineHeight: 1.65, color: INK2, fontStyle: 'italic', margin: 0 }}>{p.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PitchingCard({ data, t }) {
  if (!data || (!data.starter && !data.bullpen)) return null;
  const paragraph = {
    fontFamily: INTER, fontSize: 17, lineHeight: 1.85, color: INK,
    fontStyle: 'italic', textAlign: 'justify', hyphens: 'auto', margin: 0,
  };
  return (
    <div>
      <SectionHead label="Pitching" t={t} />
      {data.starter && (
        <p
          style={{ ...paragraph, marginBottom: data.bullpen ? 14 : 0 }}
          dangerouslySetInnerHTML={{ __html: data.starter }}
        />
      )}
      {data.bullpen && (
        <p style={paragraph} dangerouslySetInnerHTML={{ __html: data.bullpen }} />
      )}
    </div>
  );
}

function PitchArsenalCard({ data, t }) {
  if (!data?.pitches?.length) return null;
  const n = data.pitches.length;
  return (
    <div>
      <SectionHead label="Pitch Arsenal" t={t} />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: INTER, fontSize: 18, fontWeight: 700, color: t.navy }}>{data.pitcher}</span>
        <span style={{ fontSize: 13, color: MUTED, fontStyle: 'italic', fontFamily: INTER }}>{data.totalPitches} pitches</span>
      </div>
      <div style={{ fontSize: 11, color: MUTED, fontFamily: INTER, marginBottom: 12 }}>
        Bar: share of this game's pitches{data.hasSeasonMix ? ' · tick: season share' : ''}
      </div>

      {data.pitches.map((p, i) => (
        <div key={p.code} style={{ paddingBottom: 12, marginBottom: i < n - 1 ? 12 : 0, borderBottom: i < n - 1 ? `1px solid ${PAPER2}` : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: t.navy }}>{p.name}</span>
            {p.avgVelo != null && (
              <span style={{ fontSize: 12.5, color: MUTED, fontFamily: INTER, fontVariantNumeric: 'tabular-nums' }}>
                {p.avgVelo} mph avg{p.maxVelo != null && p.maxVelo > p.avgVelo ? ` · ${p.maxVelo} max` : ''}
              </span>
            )}
          </div>

          <div style={{ position: 'relative', height: 10, background: PAPER2, marginBottom: 6 }}>
            <div style={{ width: `${p.gamePct}%`, height: '100%', background: t.teal }} />
            {p.seasonPct != null && (
              <div style={{ position: 'absolute', top: -2, bottom: -2, left: `calc(${Math.min(p.seasonPct, 100)}% - 1px)`, width: 2, background: t.navy }} />
            )}
          </div>

          <div style={{ fontSize: 12.5, fontFamily: INTER, color: INK2, fontVariantNumeric: 'tabular-nums' }}>
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

          {p.note && (
            <p style={{ fontFamily: INTER, fontSize: 14, lineHeight: 1.65, color: INK2, fontStyle: 'italic', margin: '5px 0 0' }}>{p.note}</p>
          )}
        </div>
      ))}

      {data.insight && (
        <div style={{ borderLeft: `3px solid ${t.teal}`, paddingLeft: 10, marginTop: 14 }}>
          <p style={{ fontFamily: INTER, fontSize: 14, lineHeight: 1.7, color: t.teal, fontStyle: 'italic', margin: 0 }}>{data.insight}</p>
        </div>
      )}
    </div>
  );
}

// Archival-clipping treatment: double rules top and bottom, dateline, headline, story
function OnThisDayCard({ data, t }) {
  if (!data) return null;
  const dateLabel = new Date(`2000-${data.monthDay}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric',
  });
  return (
    <div>
      <SectionHead label="On This Day" t={t} />
      <div style={{ background: PAPER2, borderTop: `4px double ${t.navy}`, borderBottom: `4px double ${t.navy}`, padding: '16px 18px' }}>
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
              <span style={{ fontSize: 13, color: t.lteal, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
            <div style={{ fontSize: 12, color: t.lteal, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Watch on MLB YouTube</div>
          </a>
        )}
        <div style={{ padding: '7px 12px', borderTop: `1px solid ${t.navy}`, fontSize: 12, color: MUTED, fontStyle: 'italic', fontFamily: INTER, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Official MLB Highlights</span>
          {videoId && (
            <a href={`https://youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" style={{ color: t.teal, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>YouTube ↗</a>
          )}
        </div>
      </div>
    </div>
  );
}

// Tiny inline SVG line chart for a series of normalized values
function Sparkline({ data, color, width = 120, height = 24 }) {
  if (!data || data.length < 2) return null;
  const probs = data.map(d => d.implied_prob);
  const min = Math.min(...probs);
  const max = Math.max(...probs);
  const range = max - min || 1;
  const points = probs
    .map((p, i) => {
      const x = (i / (probs.length - 1)) * (width - 2) + 1;
      const y = height - 1 - ((p - min) / range) * (height - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
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

function TitleOddsCard({ data, trend, t }) {
  if (!data) return null;
  const pct = (data.impliedProb * 100).toFixed(1);
  const oddsStr = data.medianOdds > 0 ? `+${data.medianOdds}` : String(data.medianOdds);
  const first = trend?.[0]?.implied_prob;
  const last  = trend?.[trend.length - 1]?.implied_prob;
  const haveTrend = trend && trend.length >= 2 && first != null && last != null;
  const deltaPp = haveTrend ? ((last - first) * 100).toFixed(1) : null;
  const deltaSign = haveTrend ? (Number(deltaPp) >= 0 ? '+' : '') : '';
  return (
    <div>
      <SectionHead label="WS Odds" t={t} />
      <div style={{ borderLeft: `3px solid ${t.teal}`, paddingLeft: 14 }}>
        <div style={{ fontFamily: FRAUNCES, fontSize: 22, fontWeight: 900, color: t.navy, marginBottom: 6, ...OPSZ9 }}>{pct}%</div>
        <div style={{ fontSize: 14, color: INK2, lineHeight: 1.9, fontFamily: INTER, fontStyle: 'italic' }}>To win the World Series</div>
        {haveTrend && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <Sparkline data={trend} color={t.navy} width={90} height={22} />
            <span style={{ fontSize: 12, color: t.teal, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}>
              {trend.length}d · {deltaSign}{deltaPp}pp
            </span>
          </div>
        )}
        <div style={{ fontSize: 13, color: MUTED, fontFamily: INTER, fontStyle: 'italic', marginTop: 6 }}>
          <span style={{ color: t.teal, fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontStyle: 'normal' }}>Median: </span>
          <span style={{ color: t.navy, fontWeight: 700, fontStyle: 'normal' }}>{oddsStr}</span> · {data.bookmakerCount} US books
        </div>
      </div>
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
          <div><span style={{ color: t.teal, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>First pitch: </span>{data.time}</div>
          {data.pitcher && <div><span style={{ color: t.teal, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Probable: </span>{data.pitcher}</div>}
        </div>
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
  const [activeZone, setActiveZone] = useState('game');

  // Track which zone the reader is in so the sticky section index can highlight it
  useEffect(() => {
    if (!data) return;
    const NAV_H = 48;
    function onScroll() {
      let current = 'game';
      for (const id of ['game', 'learn', 'club']) {
        const el = document.getElementById(`zone-${id}`);
        if (el && el.getBoundingClientRect().top <= NAV_H + 24) current = id;
      }
      setActiveZone(current);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [data]);

  function jumpToZone(id) {
    const el = document.getElementById(`zone-${id}`);
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

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
    document.title = teamConfig?.brandTitle ?? "The M's Minute";
  }, [team]);

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
        pitching: report.pitching ?? null,
        pitchArsenal: report.pitchArsenal ?? null,
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

  // Resolve the active team config (theme + branding). Fall back to a neutral
  // navy/teal until the registry has loaded so the masthead doesn't flash white.
  const teamConfig = teams?.find(x => x.key === team);
  const t = teamConfig?.theme ?? { navy: '#0C2340', teal: '#005C5C', lteal: '#A8C8C8' };
  const brandTitle = teamConfig?.brandTitle ?? "The M's Minute";
  const editionLabel = teamConfig?.edition ?? '';

  // Page zones — newspaper sections. A zone renders only when it has content.
  const zones = data
    ? [
        { id: 'game', label: 'Game', kicker: 'Section A', title: 'The Game', show: true },
        { id: 'learn', label: 'Learn', kicker: 'Section B', title: 'Learn the Game', show: !!(data.pitchArsenal || data.statOfGame || data.onThisDay) },
        { id: 'club', label: 'Club', kicker: 'Section C', title: 'Around the Club', show: !!(data.standings?.length || data.nextGame || data.titleOdds) },
      ].filter(z => z.show)
    : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,900;1,9..144,400&family=Inter:ital,wght@0,400;0,600;0,700;1,400&display=swap');
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        em { color: ${t.navy}; font-style: normal; font-weight: 700; }
        a  { color: inherit; }
      `}</style>

      <div style={{ background: PAPER, minHeight: '100vh', color: INK }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 20px 64px' }}>

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
                aria-label="Choose edition"
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
            <div style={{ textAlign: 'center', fontSize: 13, color: MUTED, fontStyle: 'italic', fontFamily: INTER }}>
              {todayFormatted()}
            </div>
          </div>

          {/* Error — nothing loaded */}
          {error && !data && (
            <div style={{ margin: '24px 0', padding: '18px', border: `1px solid ${WIN_RED}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: WIN_RED, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Edition Unavailable</div>
              <div style={{ fontSize: 15, color: INK2, lineHeight: 1.6, fontFamily: INTER, fontStyle: 'italic' }}>{error}</div>
              <button onClick={() => loadReport(team)} style={{ marginTop: 12, background: t.navy, color: PAPER, border: 'none', padding: '8px 16px', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>Retry</button>
            </div>
          )}

          {/* Loading spinner — before any data arrives */}
          {loading && !data && !error && (
            <div style={{ textAlign: 'center', padding: '52px 0' }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${PAPER2}`, borderTopColor: t.teal, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
              <div style={{ fontSize: 14, color: MUTED, fontStyle: 'italic', fontFamily: INTER }}>Compiling today's edition…</div>
            </div>
          )}

          {/* Content */}
          {data && (
            <>
              {zones.length > 1 && (
                <SectionNav zones={zones} active={activeZone} onJump={jumpToZone} t={t} />
              )}

              <section id="zone-game" style={{ scrollMarginTop: 56 }}>
                <ZoneBanner kicker="Section A" label="The Game" t={t} />
                <ScoreCard data={data.gameData} teamAbbr={data.teamAbbr} t={t} />
                <NarrativeCard text={data.narrative} t={t} />
                <OffenseCard players={data.offense} t={t} />
                <PitchingCard data={data.pitching} t={t} />
                <YouTubeCard videoId={data.ytVideoId} oppName={data.gameData.oppName} teamName={data.teamName} t={t} />
              </section>

              {(data.pitchArsenal || data.statOfGame || data.onThisDay) && (
                <section id="zone-learn" style={{ scrollMarginTop: 56 }}>
                  <ZoneBanner kicker="Section B" label="Learn the Game" t={t} />
                  <PitchArsenalCard data={data.pitchArsenal} t={t} />
                  <StatOfGameCard stat={data.statOfGame} t={t} />
                  <OnThisDayCard data={data.onThisDay} t={t} />
                </section>
              )}

              {(data.standings?.length > 0 || data.nextGame || data.titleOdds) && (
                <section id="zone-club" style={{ scrollMarginTop: 56 }}>
                  <ZoneBanner kicker="Section C" label="Around the Club" t={t} />
                  <StandingsCard rows={data.standings} divisionName={data.divisionName} t={t} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <NextGameCard data={data.nextGame} teamAbbr={data.teamAbbr} t={t} />
                    <TitleOddsCard data={data.titleOdds} trend={data.titleOddsTrend} t={t} />
                  </div>
                </section>
              )}

              <div style={{ height: 2, background: t.navy, margin: '32px 0 12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', fontFamily: INTER }}>MLB data · Claude AI</div>
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
          <div
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
                onClick={() => setPickerOpen(false)}
                aria-label="Close"
                style={{
                  width: 48, height: 48, background: 'transparent', border: 'none',
                  cursor: 'pointer', fontSize: 26, lineHeight: 1, color: INK,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: INTER,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ maxWidth: 520, margin: '0 auto', padding: '4px 20px 64px' }}>
              <div style={{ height: 2, background: INK, marginBottom: 14 }} />
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED, textAlign: 'center', marginBottom: 6 }}>
                Choose Edition
              </div>
              <h2 style={{ fontFamily: FRAUNCES, fontSize: 36, fontWeight: 900, color: INK, textAlign: 'center', lineHeight: 1, letterSpacing: '-0.5px', margin: '0 0 28px', ...OPSZ9 }}>
                Editions
              </h2>

              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {teams.map((tm, i) => {
                  const selected = team === tm.key;
                  return (
                    <li key={tm.key}>
                      <button
                        onClick={() => { selectTeam(tm.key); setPickerOpen(false); }}
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
                          <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', letterSpacing: '0.04em' }}>
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
        )}
      </div>
    </>
  );
}
