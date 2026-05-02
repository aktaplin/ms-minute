import { useState, useEffect } from "react";

// ── Palette — all pairs AA-verified ─────────────────────────────────────────
const PAPER   = "#F6F1E7";
const PAPER2  = "#EDE7D8";
const NAVY    = "#0C2340";
const TEAL    = "#005C5C";
const INK     = "#1A1A1A";
const INK2    = "#444444";
const MUTED   = "#5C5347";
const LTEAL   = "#A8C8C8";
const LGREY   = "#C8D4DC";
const WIN_RED = "#8B1A1A";


// ── Cached system prompt — sent once, cached for ~5min, 10% cost on repeats ──
const SYS_VOICE = `You write for The M's Minute, a daily Seattle Mariners fan newsletter. Voice: warm, knowledgeable, vivid — like a friend who watched the game and is telling you about it over coffee. Always conversational, never corporate. When asked for JSON, return ONLY valid JSON with no markdown fences, no commentary, no trailing commas. When asked for prose, output ONLY the requested sentences with no preamble.`;

function todayFormatted() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// ── Claude API — agentic loop handles web_search turns ──────────────────────
const MODEL_SONNET = "claude-sonnet-4-20250514";
const MODEL_HAIKU  = "claude-haiku-4-5-20251001";

async function callClaude(prompt, opts = {}) {
  const {
    useSearch = true,
    maxTokens = 1200,
    model = MODEL_SONNET,
    maxSearches = 3,
    systemPrompt = null
  } = opts;

  const tools = useSearch
    ? [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }]
    : [];

  // Cache the system prompt across calls within a session (10% cost on repeats)
  const system = systemPrompt
    ? [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }]
    : undefined;

  let messages = [{ role: "user", content: prompt }];

  for (let i = 0; i < 10; i++) {
    const body = { model, max_tokens: maxTokens, tools, messages };
    if (system) body.system = system;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    messages.push({ role: "assistant", content: data.content });
    if (data.stop_reason === "end_turn") {
      return data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    }
    if (data.stop_reason === "tool_use") {
      const results = data.content
        .filter(b => b.type === "tool_use")
        .map(b => ({ type: "tool_result", tool_use_id: b.id, content: "done" }));
      messages.push({ role: "user", content: results });
      continue;
    }
    return data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
  }
  throw new Error("Too many tool call rounds");
}

function parseJSON(raw) {
  const clean = raw.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(clean.slice(start, end + 1));
}

// ── Shared layout ────────────────────────────────────────────────────────────
function SectionHead({ label }) {
  return (
    <div style={{ marginTop: 28, marginBottom: 14 }}>
      <div style={{ height: 2, background: NAVY, marginBottom: 6 }} />
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: TEAL }}>
        {label}
      </div>
    </div>
  );
}

// ── Section components ────────────────────────────────────────────────────────

function ScoreCard({ data }) {
  if (!data) return null;
  return (
    <div>
      <SectionHead label="Last Game" />
      <div style={{ display: "flex" }}>
        <div style={{ flex: "0 0 44%", paddingRight: 18, borderRight: `1px solid ${NAVY}` }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 54, fontWeight: 900, color: NAVY, lineHeight: 1, marginBottom: 6 }}>
            {data.mScore}–{data.oScore}
          </div>
          <div style={{ fontSize: 10, color: INK2, marginBottom: 10 }}>SEA vs. {data.oppAbbr}</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: data.won ? TEAL : WIN_RED, borderBottom: `2px solid ${data.won ? TEAL : WIN_RED}`, display: "inline-block", paddingBottom: 1 }}>
            {data.won ? "Win" : "Loss"}
          </div>
        </div>
        <div style={{ flex: 1, paddingLeft: 18 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 13, fontStyle: "italic", color: INK2, marginBottom: 10 }}>{data.oppName}</div>
          <div style={{ fontSize: 11, color: MUTED, lineHeight: 2 }}>
            <div>{data.venue}</div>
            <div>{data.gameDate}</div>
          </div>
          {data.startingPitcher && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${PAPER2}`, fontSize: 10, color: INK2 }}>
              <span style={{ color: TEAL, fontWeight: 700, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>Starter: </span>
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
      <p style={{ fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.85, color: INK, fontStyle: "italic", textAlign: "justify", hyphens: "auto" }}
        dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  );
}

function OffenseCard({ players }) {
  if (!players?.length) return null;
  return (
    <div>
      <SectionHead label="At the Plate" />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {players.map((p, i) => (
          <div key={p.name} style={{ paddingTop: i === 0 ? 0 : 12, paddingBottom: 12, borderBottom: i < players.length - 1 ? `1px solid ${PAPER2}` : "none" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 900, color: NAVY }}>{p.name}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: TEAL, letterSpacing: "0.12em", textTransform: "uppercase" }}>{p.pos}</span>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {p.stats.map(s => (
                  <div key={s.lbl} style={{ border: `1px solid ${NAVY}`, padding: "2px 7px", textAlign: "center", minWidth: 32 }}>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 700, color: NAVY, lineHeight: 1.1 }}>{s.val}</div>
                    <div style={{ fontSize: 7, color: TEAL, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
            {p.note && <p style={{ fontFamily: "Georgia, serif", fontSize: 12, lineHeight: 1.65, color: INK2, fontStyle: "italic", margin: 0 }}>{p.note}</p>}
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
      <div style={{ background: NAVY, padding: "18px 20px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: LTEAL, marginBottom: 8 }}>
          {stat.label || "By the Numbers"}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 42, fontWeight: 900, color: PAPER, lineHeight: 1 }}>{stat.value}</div>
          <div style={{ fontSize: 12, color: LTEAL, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{stat.abbr}</div>
        </div>
        <div style={{ fontSize: 10, color: LTEAL, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>{stat.player}</div>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.75, color: LGREY, marginBottom: 12 }}>{stat.explanation}</p>
        <div style={{ borderLeft: `3px solid ${LTEAL}`, paddingLeft: 12, fontFamily: "Georgia, serif", fontSize: 12, lineHeight: 1.65, color: LGREY, fontStyle: "italic" }}>{stat.context}</div>
      </div>
    </div>
  );
}

function YouTubeCard({ videoId, query }) {
  const fallbackUrl = `https://www.youtube.com/@MLB/search?query=${encodeURIComponent(query)}`;
  return (
    <div>
      <SectionHead label="Game Highlights" />
      <div style={{ border: `1px solid ${NAVY}` }}>
        {videoId ? (
          <div style={{ position: "relative", width: "100%", paddingTop: "56.25%" }}>
            <iframe src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
              title="Mariners Game Highlights" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} />
          </div>
        ) : (
          <a href={fallbackUrl} target="_blank" rel="noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", aspectRatio: "16/9", background: NAVY, textDecoration: "none", gap: 10 }}>
            <div style={{ fontSize: 32, color: PAPER, opacity: 0.5 }}>▶</div>
            <div style={{ fontSize: 10, color: LTEAL, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Watch on MLB YouTube</div>
          </a>
        )}
        <div style={{ padding: "7px 12px", borderTop: `1px solid ${NAVY}`, fontSize: 10, color: MUTED, fontStyle: "italic", fontFamily: "Georgia, serif", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Official MLB Highlights</span>
          {videoId && <a href={`https://youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" style={{ color: TEAL, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>YouTube ↗</a>}
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
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${NAVY}` }}>
            {["", "Team", "W", "L", "GB"].map(h => (
              <th key={h} style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: TEAL, padding: "4px 6px 7px", textAlign: (h === "Team" || h === "") ? "left" : "right" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.name} style={{ borderBottom: `1px solid ${PAPER2}` }}>
              <td style={{ padding: "7px 6px", fontSize: 10, color: MUTED, width: 20 }}>{i + 1}</td>
              <td style={{ padding: "7px 6px", fontSize: 13, fontWeight: t.isM ? 700 : 400, color: t.isM ? NAVY : INK, fontFamily: t.isM ? "'Playfair Display', Georgia, serif" : "inherit" }}>
                {t.isM ? <span>▸ {t.name}</span> : t.name}
              </td>
              <td style={{ padding: "7px 6px", fontSize: 12, color: INK, textAlign: "right", fontFamily: "Georgia, serif" }}>{t.w}</td>
              <td style={{ padding: "7px 6px", fontSize: 12, color: INK2, textAlign: "right", fontFamily: "Georgia, serif" }}>{t.l}</td>
              <td style={{ padding: "7px 6px", fontSize: 11, color: MUTED, textAlign: "right" }}>{i === 0 ? "—" : `+${t.gb}`}</td>
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
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 900, color: NAVY, marginBottom: 6 }}>SEA vs. {data.oppAbbr}</div>
        <div style={{ fontSize: 12, color: INK2, lineHeight: 1.9, fontFamily: "Georgia, serif" }}>
          <div style={{ fontStyle: "italic" }}>{data.oppName}</div>
          <div>{data.venue}</div>
          <div><span style={{ color: TEAL, fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>First pitch: </span>{data.time}</div>
          {data.pitcher && <div><span style={{ color: TEAL, fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>M's probable: </span>{data.pitcher}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton — shows structure while content arrives ─────────────────
function Skeleton({ height = 16, width = "100%", style = {} }) {
  return (
    <div style={{
      height, width, background: PAPER2, borderRadius: 2,
      animation: "pulse 1.5s ease-in-out infinite", ...style
    }} />
  );
}

function SectionSkeleton({ lines = 3 }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ height: 2, background: PAPER2, marginBottom: 6 }} />
      <Skeleton height={9} width={80} style={{ marginBottom: 14 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={13} width={i === lines - 1 ? "65%" : "100%"} style={{ marginBottom: 8 }} />
      ))}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function MsMinute() {
  // Each section has its own loading state so they can render as they arrive
  const [gameData, setGameData]       = useState(null);
  const [narrative, setNarrative]     = useState(null);
  const [offense, setOffense]         = useState(null);
  const [statOfGame, setStatOfGame]   = useState(null);
  const [ytVideoId, setYtVideoId]     = useState(null);
  const [error, setError]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [facts, setFacts]             = useState(null);

  useEffect(() => { loadReport(); }, []);

  async function loadReport() {
    setLoading(true);
    setGameData(null); setNarrative(null); setOffense(null); setFacts(null);
    setStatOfGame(null); setYtVideoId(null); setError(null);

// ── Session cache: skip API calls if we have a fresh report (< 1hr old) ──
    const cacheKey = `report:${new Date().toISOString().slice(0, 13)}`; // hourly key
    try {
      const cached = await window.storage?.get(cacheKey);
      if (cached?.value) {
        const data = JSON.parse(cached.value);
        setFacts(data.facts);
        setGameData(data.facts.lastGame);
        setOffense(data.offense);
        setNarrative(data.narrative);
        setStatOfGame(data.statOfGame);
        setYtVideoId(data.ytVideoId);
        setLoading(false);
        return;
      }
    } catch(e) { /* no cache, proceed */ }

    try {
      // ── BATCH A: fire two searches simultaneously ────────────────────────
      // A1 — game facts (box score, standings, next game)
      // A2 — YouTube video ID (totally independent, no need to wait)
      const [factsRaw, ytRaw] = await Promise.all([

        callClaude(`Search for the most recent completed Seattle Mariners MLB game.
          Return ONLY valid JSON, no markdown, no trailing commas:
          {
            "lastGame": {
              "won": true,
              "mScore": 5, "oScore": 3,
              "oppName": "Houston Astros", "oppAbbr": "HOU",
              "venue": "T-Mobile Park", "gameDate": "May 1",
              "startingPitcher": { "name": "George Kirby", "ip": "7.0", "k": 8, "er": 1, "bb": 1 }
            },
            "offensivePerformers": [
              { "name": "Julio Rodriguez", "pos": "CF", "hits": 2, "ab": 4, "hr": 1, "rbi": 3, "bb": 1, "note": "One vivid sentence about their night." },
              { "name": "Cal Raleigh", "pos": "C", "hits": 1, "ab": 3, "hr": 0, "rbi": 1, "bb": 1, "note": "One vivid sentence about their night." },
              { "name": "Mitch Garver", "pos": "DH", "hits": 2, "ab": 4, "hr": 0, "rbi": 0, "bb": 0, "note": "One vivid sentence about their night." }
            ],
            "topStat": {
              "abbr": "WHIP", "value": "0.71",
              "player": "George Kirby",
              "rawFact": "One sentence of raw context: what happened in the game that makes this stat interesting."
            },
            "standings": [
              { "name": "Mariners", "isM": true, "w": 20, "l": 12, "gb": 0 },
              { "name": "Astros",   "isM": false, "w": 18, "l": 14, "gb": 2 },
              { "name": "Angels",   "isM": false, "w": 15, "l": 17, "gb": 5 },
              { "name": "Athletics","isM": false, "w": 14, "l": 18, "gb": 6 },
              { "name": "Rangers",  "isM": false, "w": 12, "l": 20, "gb": 8 }
            ],
            "nextGame": {
              "oppName": "Los Angeles Angels", "oppAbbr": "LAA",
              "venue": "Home - T-Mobile Park", "time": "7:10 PM PT", "pitcher": "Logan Gilbert"
            }
          }`, { useSearch: true, maxTokens: 1200, maxSearches: 3, systemPrompt: SYS_VOICE }),

        callClaude(`Search YouTube for the most recent Seattle Mariners highlight or recap video
          on the MLB channel. Find a youtube.com/watch?v=XXXXXXXXXXX URL and extract
          the 11-character video ID. Return ONLY a JSON object: { "videoId": "XXXXXXXXXXX" }
          If not found, return: { "videoId": null }`, { useSearch: true, maxTokens: 200, maxSearches: 2 })
      ]);

      // Parse batch A results
      const facts = parseJSON(factsRaw);
      let videoId = null;
      try { videoId = parseJSON(ytRaw).videoId || null; } catch(e) {}

      setFacts(facts);
      const g = facts.lastGame;
      const performers = facts.offensivePerformers || [];
      const topStat = facts.topStat;

      // Render what we have immediately — score, standings, next game, YouTube
      setGameData(g);
      setYtVideoId(videoId);
      setOffense(performers.map(p => ({
        name: p.name, pos: p.pos, note: p.note || "",
        stats: [
          { val: `${p.hits}/${p.ab}`, lbl: "H/AB" },
          ...(p.hr > 0  ? [{ val: p.hr,  lbl: "HR"  }] : []),
          ...(p.rbi > 0 ? [{ val: p.rbi, lbl: "RBI" }] : []),
          ...(p.bb > 0  ? [{ val: p.bb,  lbl: "BB"  }] : []),
        ].slice(0, 3)
      })));

      // ── BATCH B: two writing calls in parallel, now that we have facts ───
      const perfSummary = performers.map(p => `${p.name}: ${p.hits}/${p.ab}, ${p.hr} HR, ${p.rbi} RBI`).join("; ");

      const [narrativeRaw, statRaw] = await Promise.all([

        callClaude(`Write a 3-sentence game recap for a Seattle Mariners fan newsletter.
          Game: Mariners ${g.won ? "defeated" : "lost to"} the ${g.oppName} ${g.mScore}-${g.oScore}.
          ${g.startingPitcher ? `Starter: ${g.startingPitcher.name} — ${g.startingPitcher.ip} IP, ${g.startingPitcher.k} K, ${g.startingPitcher.er} ER.` : ""}
          ${perfSummary ? `Key hitters: ${perfSummary}.` : ""}
          Rules: exactly 3 sentences, vivid and conversational, wrap player names in <em> tags,
          end with something emotionally resonant. Output ONLY the paragraph.`, false, 400),

        callClaude(`Write a stat explanation for a Mariners fan newsletter. Keep it plain English.
          Stat: ${topStat?.abbr} = ${topStat?.value} by ${topStat?.player}
          Game context: ${topStat?.rawFact}
          Game result: Mariners ${g.won ? "won" : "lost"} ${g.mScore}-${g.oScore} vs ${g.oppName}.

          Return ONLY valid JSON, no markdown:
          {
            "abbr": "${topStat?.abbr}",
            "label": "Stat of the Game",
            "value": "${topStat?.value}",
            "player": "${topStat?.player}",
            "explanation": "2 sentences: what this stat measures in plain English, and why this number was significant in tonight's game.",
            "context": "1 sentence: league average or historical Mariners context to calibrate the number."
          }`, { useSearch: false, maxTokens: 400, model: MODEL_HAIKU, systemPrompt: SYS_VOICE })
      ]);

      setNarrative(narrativeRaw.trim());
      try { setStatOfGame(parseJSON(statRaw)); } catch(e) {}

      // Cache result for fast reload within the hour
      try {
        await window.storage?.set(cacheKey, JSON.stringify({
          facts, offense: performers.map(p => ({
            name: p.name, pos: p.pos, note: p.note || "",
            stats: [
              { val: `${p.hits}/${p.ab}`, lbl: "H/AB" },
              ...(p.hr > 0  ? [{ val: p.hr,  lbl: "HR"  }] : []),
              ...(p.rbi > 0 ? [{ val: p.rbi, lbl: "RBI" }] : []),
              ...(p.bb > 0  ? [{ val: p.bb,  lbl: "BB"  }] : []),
            ].slice(0, 3)
          })),
          narrative: narrativeRaw.trim(),
          statOfGame: (() => { try { return parseJSON(statRaw); } catch { return null; } })(),
          ytVideoId: videoId
        }));
      } catch(e) { /* caching is best-effort */ }

      setLoading(false);

    } catch(err) {
      setError(err.message);
      setLoading(false);
    }
  }

  const ytQuery = gameData
    ? `Seattle Mariners ${gameData.oppName} highlights ${new Date().getFullYear()}`
    : "Seattle Mariners highlights";

  const anyLoading = loading && !gameData;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap');
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        em { color: #005C5C; font-style: normal; font-weight: 700; }
        a  { color: inherit; }
      `}</style>

      <div style={{ background: PAPER, minHeight: "100vh", color: INK }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 20px 64px" }}>

          {/* ── Masthead ── */}
          <div style={{ paddingTop: 28 }}>
            <div style={{ height: 4, background: NAVY, marginBottom: 16 }} />
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: TEAL, borderTop: `1px solid ${TEAL}`, borderBottom: `1px solid ${TEAL}`, padding: "3px 14px", display: "inline-block" }}>
                Seattle Mariners · Daily Edition
              </span>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(40px, 12vw, 64px)", fontWeight: 900, color: NAVY, textAlign: "center", lineHeight: 1, letterSpacing: "-1px", margin: "0 0 10px" }}>
              The M's Minute
            </h1>
            <div style={{ textAlign: "center", fontSize: 11, color: MUTED, fontStyle: "italic", fontFamily: "Georgia, serif" }}>
              {todayFormatted()}
            </div>
          </div>

          {/* ── Full error (nothing loaded yet) ── */}
          {error && !gameData && (
            <div style={{ margin: "24px 0", padding: "18px", border: `1px solid ${WIN_RED}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: WIN_RED, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Edition Unavailable</div>
              <div style={{ fontSize: 13, color: INK2, lineHeight: 1.6, fontFamily: "Georgia, serif", fontStyle: "italic" }}>{error}</div>
              <button onClick={loadReport} style={{ marginTop: 12, background: NAVY, color: PAPER, border: "none", padding: "8px 16px", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>Retry</button>
            </div>
          )}

          {/* ── Initial full-page spinner (only before ANY data arrives) ── */}
          {anyLoading && (
            <div style={{ textAlign: "center", padding: "52px 0" }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${PAPER2}`, borderTopColor: TEAL, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
              <div style={{ fontSize: 12, color: MUTED, fontStyle: "italic", fontFamily: "Georgia, serif" }}>Compiling today's edition…</div>
            </div>
          )}

          {/* ── Progressive content — each section renders as soon as its data arrives ── */}
          {gameData && (
            <>
              {/* Score — available after Batch A */}
              <ScoreCard data={gameData} />

              {/* Recap — skeleton until Batch B finishes */}
              {narrative
                ? <NarrativeCard text={narrative} />
                : <SectionSkeleton lines={4} />}

              {/* At the Plate — available after Batch A */}
              {offense
                ? <OffenseCard players={offense} />
                : <SectionSkeleton lines={5} />}

              {/* Stat of the Game — skeleton until Batch B finishes */}
              {statOfGame
                ? <StatOfGameCard stat={statOfGame} />
                : <SectionSkeleton lines={4} />}

              {/* YouTube — available after Batch A */}
              <YouTubeCard videoId={ytVideoId} query={ytQuery} />

              {/* Standings & Next Game — available after Batch A */}
              <StandingsCard rows={facts?.standings} />
              <NextGameCard data={facts?.nextGame} />

              <div style={{ height: 2, background: NAVY, margin: "32px 0 12px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 10, color: MUTED, fontStyle: "italic", fontFamily: "Georgia, serif" }}>MLB data · Claude AI</div>
                <button onClick={loadReport} style={{ background: "transparent", border: `1px solid ${NAVY}`, color: NAVY, padding: "5px 12px", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>Refresh</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
