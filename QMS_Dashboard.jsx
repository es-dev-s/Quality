import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, ReferenceLine
} from "recharts";

// ── Data ──────────────────────────────────────────────────────────────────────
const DATA = {"kpis":{"total_audits":1087,"overall_avg":87.92,"fatal_count":28,"critical_count":32,"medium_count":328,"low_count":672,"call_score":88.7,"chat_score":87.4,"call_count":520,"chat_count":566,"fb_done":905,"fb_pending":87,"week1":780,"week2":305,"below_80":13,"btw_80_90":52,"btw_90_95":56,"above_95":11},"params":[{"name":"Greeting","score":86.6,"max":3,"avg":2.6},{"name":"Permission","score":92.4,"max":3,"avg":2.77},{"name":"Closing","score":84.9,"max":3,"avg":2.55},{"name":"Active Listening","score":84.5,"max":5,"avg":4.23},{"name":"Empathy/Apology","score":87.9,"max":4,"avg":3.51},{"name":"Preferred Mode","score":89.1,"max":3,"avg":2.67},{"name":"Voice Clarity","score":63.1,"max":4,"avg":2.52},{"name":"Context Setting","score":91.4,"max":4,"avg":3.65},{"name":"Professionalism","score":73.9,"max":4,"avg":2.95},{"name":"Grammar","score":68.9,"max":5,"avg":3.45},{"name":"Rate of Speech","score":86.3,"max":5,"avg":4.31},{"name":"Probing","score":87.0,"max":5,"avg":4.35},{"name":"Correct Resolution","score":96.9,"max":10,"avg":9.69},{"name":"Complete Resolution","score":95.9,"max":10,"avg":9.59},{"name":"Value Creation","score":92.0,"max":10,"avg":9.2}],"teams":[{"team":"Summit Seekers","avg":95.0,"count":33},{"team":"Victory Magnets","avg":94.5,"count":35},{"team":"Deal Avengers","avg":93.9,"count":61},{"team":"Nitro Negotiators","avg":93.6,"count":54},{"team":"Growth Gladiators","avg":92.1,"count":45},{"team":"Trend Setters","avg":91.8,"count":33},{"team":"Success Sharks","avg":90.8,"count":39},{"team":"Fortune Finders","avg":90.4,"count":57},{"team":"Victoria","avg":90.2,"count":63},{"team":"Peak Achievers","avg":90.1,"count":27},{"team":"Language Warriors","avg":90.0,"count":48},{"team":"Veritas Engines","avg":89.1,"count":35},{"team":"Limit Breakers","avg":88.9,"count":48},{"team":"Conversion Queens","avg":87.6,"count":63},{"team":"Rapid Response","avg":87.5,"count":45},{"team":"ACE Performers","avg":85.6,"count":51},{"team":"Veritas Engine","avg":85.1,"count":10},{"team":"Power Players","avg":84.2,"count":45},{"team":"Mountain Movers","avg":84.2,"count":39},{"team":"KPI Krushers","avg":84.0,"count":60},{"team":"Magic Makers","avg":82.4,"count":73},{"team":"Alpha Winners","avg":82.3,"count":51},{"team":"Elite Closers","avg":79.1,"count":42},{"team":"Orbit","avg":77.6,"count":30}],"bottom_agents":[{"agent":"Inusha Thapa","avg":46.4,"count":5},{"agent":"Puja Sapkota","avg":61.4,"count":9},{"agent":"Mallika Manandhar","avg":67.3,"count":12},{"agent":"Rejina Pradhan","avg":67.4,"count":12},{"agent":"Nandani Rauniyar","avg":68.0,"count":12},{"agent":"Nikita Ojha","avg":69.1,"count":12},{"agent":"Krishina Adhikari","avg":70.7,"count":6},{"agent":"Yogisha Nakarmi","avg":71.7,"count":9},{"agent":"Rebika Gochhe","avg":72.7,"count":9},{"agent":"Puja Rajbanshi","avg":72.9,"count":9}],"top_agents":[{"agent":"Priya Gadal","avg":96.7,"count":7},{"agent":"Sandeepa Paudel","avg":96.5,"count":6},{"agent":"Kritagya Shrestha","avg":96.3,"count":9},{"agent":"Sadikshya Katwal","avg":96.2,"count":6},{"agent":"Amisha Gurung","avg":95.8,"count":6},{"agent":"Divya Gupta","avg":95.3,"count":6},{"agent":"Nipsungma Rai","avg":95.3,"count":6},{"agent":"Mridusphita Sharma","avg":95.2,"count":12},{"agent":"Subhani Shakya","avg":95.2,"count":6},{"agent":"Anu Sakha","avg":95.1,"count":5}],"auditors":[{"name":"Prakriti Malla","count":179},{"name":"Rachana Shrestha","count":170},{"name":"Rajalla Dongol","count":167},{"name":"Shwati Shrivastav","count":163},{"name":"Binisha Mool","count":159},{"name":"Monika Kumari Das","count":148},{"name":"Youbika Sharma","count":99}],"fatal_by_team":[{"team":"Magic Makers","count":6},{"team":"Elite Closers","count":5},{"team":"Alpha Winners","count":4},{"team":"Orbit","count":3},{"team":"KPI Krushers","count":3},{"team":"Power Players","count":3},{"team":"Rapid Response","count":2},{"team":"ACE Performers","count":1},{"team":"Peak Achievers","count":1}]};

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#060A10",
  surface:  "#0E1420",
  card:     "#111827",
  border:   "#1F2937",
  cyan:     "#06B6D4",
  purple:   "#8B5CF6",
  green:    "#10B981",
  amber:    "#F59E0B",
  red:      "#EF4444",
  text:     "#F1F5F9",
  muted:    "#64748B",
  sub:      "#94A3B8",
};

const scoreColor = (v) =>
  v >= 95 ? C.green : v >= 90 ? C.cyan : v >= 80 ? C.amber : C.red;

const TABS = ["Overview", "Parameters", "Teams", "Agents", "Compliance", "Auditors"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function Sparkline({ value, max = 100 }) {
  const pct = Math.min(value / max * 100, 100);
  const color = scoreColor(value);
  return (
    <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 1s ease" }} />
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}55`,
      borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "1px 7px",
      letterSpacing: 1, textTransform: "uppercase",
    }}>{label}</span>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "18px 20px", ...style
    }}>{children}</div>
  );
}

function SectionTitle({ icon, title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ color: C.text, fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>{title}</span>
      </div>
      {sub && <div style={{ color: C.muted, fontSize: 11, marginTop: 3, marginLeft: 26 }}>{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.text }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: C.sub }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.fill || p.stroke || C.cyan }}>
          {p.name}: <b>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</b>
          {p.name?.includes("Score") || p.name?.includes("avg") || p.name?.includes("score") ? "%" : ""}
        </div>
      ))}
    </div>
  );
};

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KpiTile({ label, value, sub, color, icon }) {
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ color: color || C.text, fontSize: 30, fontWeight: 800, margin: "8px 0 2px", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ color: C.muted, fontSize: 11 }}>{sub}</div>
      {typeof value === "string" && value.includes("%") && (
        <Sparkline value={parseFloat(value)} />
      )}
    </Card>
  );
}

// ── Score Gauge ───────────────────────────────────────────────────────────────
function GaugeCircle({ value, label }) {
  const r = 52, cx = 60, cy = 60;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(value / 100, 1);
  const dash = circumference * pct;
  const color = scoreColor(value);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={120} height={90} viewBox="0 0 120 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={10} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 1.2s ease" }} />
        <text x={cx} y={cy + 6} textAnchor="middle" fill={color} fontSize={18} fontWeight={800}>{value}%</text>
      </svg>
      <div style={{ color: C.sub, fontSize: 11, fontWeight: 600, marginTop: -8 }}>{label}</div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const { kpis } = DATA;
  const distData = [
    { label: "≥ 95%", value: kpis.above_95, color: C.green },
    { label: "90–95%", value: kpis.btw_90_95, color: C.cyan },
    { label: "80–90%", value: kpis.btw_80_90, color: C.amber },
    { label: "< 80%", value: kpis.below_80, color: C.red },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* KPI Row */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <KpiTile label="Total Audits" value={kpis.total_audits.toLocaleString()} sub={`${kpis.call_count} Calls · ${kpis.chat_count} Chats`} icon="🎧" color={C.cyan} />
        <KpiTile label="Overall Quality" value={`${kpis.overall_avg}%`} sub={kpis.overall_avg >= 90 ? "✔ Target Met" : "✘ Below 90% Target"} icon="📊" color={scoreColor(kpis.overall_avg)} />
        <KpiTile label="Fatal Incidents" value={kpis.fatal_count} sub="Immediate action required" icon="🚨" color={C.red} />
        <KpiTile label="Critical Issues" value={kpis.critical_count} sub={`Medium: ${kpis.medium_count}  ·  Low: ${kpis.low_count}`} icon="⚠️" color={C.amber} />
        <KpiTile label="Feedback Done" value={kpis.fb_done} sub={`${kpis.fb_pending} pending`} icon="✅" color={C.green} />
      </div>

      {/* Gauges + Distribution */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 260px" }}>
          <SectionTitle icon="🎯" title="Quality Score Gauges" />
          <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap" }}>
            <GaugeCircle value={kpis.overall_avg} label="Overall" />
            <GaugeCircle value={kpis.call_score} label="Calls" />
            <GaugeCircle value={kpis.chat_score} label="Chats" />
          </div>
        </Card>

        <Card style={{ flex: "1 1 260px" }}>
          <SectionTitle icon="📈" title="Agent Score Distribution" sub="Agents with ≥3 audits" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {distData.map(d => (
              <div key={d.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: d.color, fontSize: 12, fontWeight: 700 }}>{d.label}</span>
                  <span style={{ color: C.text, fontSize: 12, fontWeight: 800 }}>{d.value} agents</span>
                </div>
                <div style={{ height: 8, background: C.border, borderRadius: 4 }}>
                  <div style={{ width: `${d.value / (kpis.below_80 + kpis.btw_80_90 + kpis.btw_90_95 + kpis.above_95) * 100}%`, height: "100%", background: d.color, borderRadius: 4, transition: "width 1s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ flex: "1 1 200px" }}>
          <SectionTitle icon="📋" title="Audit Coverage" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            {[
              { label: "Week 1", value: kpis.week1, total: kpis.week1 + kpis.week2, color: C.cyan },
              { label: "Week 2", value: kpis.week2, total: kpis.week1 + kpis.week2, color: C.purple },
              { label: "Calls", value: kpis.call_count, total: kpis.total_audits, color: C.green },
              { label: "Chats", value: kpis.chat_count, total: kpis.total_audits, color: C.amber },
            ].map(d => (
              <div key={d.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: C.sub, fontSize: 11 }}>{d.label}</span>
                  <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>{d.value} ({Math.round(d.value/d.total*100)}%)</span>
                </div>
                <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
                  <div style={{ width: `${d.value/d.total*100}%`, height: "100%", background: d.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Fatal by team */}
      <Card>
        <SectionTitle icon="🚨" title="Fatal Incidents by Team" sub="Teams requiring immediate escalation" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
          {DATA.fatal_by_team.map(d => (
            <div key={d.team} style={{
              background: C.red + "15", border: `1px solid ${C.red}40`,
              borderRadius: 8, padding: "10px 16px", minWidth: 130, textAlign: "center"
            }}>
              <div style={{ color: C.red, fontSize: 24, fontWeight: 800 }}>{d.count}</div>
              <div style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>{d.team}</div>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}

// ── Parameters Tab ────────────────────────────────────────────────────────────
function ParametersTab() {
  const sorted = [...DATA.params].sort((a, b) => a.score - b.score);
  const radarData = DATA.params.map(p => ({ subject: p.name.replace("/", "/\n"), A: p.score }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Card style={{ flex: "2 1 400px" }}>
          <SectionTitle icon="📡" title="Quality Parameter Scores" sub="All parameters vs 90% target" />
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={sorted} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
              <YAxis domain={[0, 110]} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => v + "%"} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={90} stroke={C.cyan} strokeDasharray="5 5" label={{ value: "Target 90%", fill: C.cyan, fontSize: 10 }} />
              <Bar dataKey="score" name="Score" radius={[4, 4, 0, 0]}>
                {sorted.map((d, i) => <Cell key={i} fill={scoreColor(d.score)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ flex: "1 1 300px" }}>
          <SectionTitle icon="🕸️" title="Radar View" sub="Parameter coverage map" />
          <ResponsiveContainer width="100%" height={340}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={C.border} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: C.sub, fontSize: 9 }} />
              <Radar name="Score" dataKey="A" stroke={C.cyan} fill={C.cyan} fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <SectionTitle icon="📋" title="Parameter Detail Table" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Parameter", "Avg Raw", "Max", "Score %", "Status", "Gap to Target"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", color: C.muted, fontWeight: 600, textAlign: "left", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DATA.params.map((p, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}20`, background: i % 2 === 0 ? C.surface + "60" : "transparent" }}>
                  <td style={{ padding: "10px 12px", color: C.text, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "10px 12px", color: C.sub }}>{p.avg}</td>
                  <td style={{ padding: "10px 12px", color: C.muted }}>{p.max}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: scoreColor(p.score), fontWeight: 800 }}>{p.score}%</span>
                      <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3, minWidth: 60 }}>
                        <div style={{ width: `${p.score}%`, height: "100%", background: scoreColor(p.score), borderRadius: 3 }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge label={p.score >= 95 ? "Excellent" : p.score >= 90 ? "Good" : p.score >= 80 ? "Fair" : "Critical"} 
                           color={scoreColor(p.score)} />
                  </td>
                  <td style={{ padding: "10px 12px", color: p.score >= 90 ? C.green : C.red, fontWeight: 700 }}>
                    {p.score >= 90 ? `+${(p.score - 90).toFixed(1)}%` : `${(p.score - 90).toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Teams Tab ─────────────────────────────────────────────────────────────────
function TeamsTab() {
  const [view, setView] = useState("chart");
  const above90 = DATA.teams.filter(t => t.avg >= 90).length;
  const below90 = DATA.teams.filter(t => t.avg < 90).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <KpiTile label="Teams Above Target" value={above90} sub="≥ 90% quality score" icon="🏆" color={C.green} />
        <KpiTile label="Teams Below Target" value={below90} sub="< 90% — needs coaching" icon="📉" color={C.red} />
        <KpiTile label="Top Team" value="Summit Seekers" sub="95.0% avg quality" icon="🥇" color={C.amber} />
        <KpiTile label="Weakest Team" value="Orbit" sub="77.6% avg quality" icon="⚠️" color={C.red} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        {["chart", "table"].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? C.cyan : C.card, color: view === v ? C.bg : C.sub,
            border: `1px solid ${view === v ? C.cyan : C.border}`, borderRadius: 6,
            padding: "6px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize"
          }}>{v === "chart" ? "📊 Chart View" : "📋 Table View"}</button>
        ))}
      </div>

      {view === "chart" ? (
        <Card>
          <SectionTitle icon="🏅" title="Team Performance Ranking" sub="Sorted by average quality score" />
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={[...DATA.teams].reverse()} layout="vertical" margin={{ left: 120, right: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" domain={[70, 100]} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => v + "%"} />
              <YAxis type="category" dataKey="team" tick={{ fill: C.sub, fontSize: 10 }} width={115} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={90} stroke={C.cyan} strokeDasharray="5 5" />
              <Bar dataKey="avg" name="Avg Score" radius={[0, 4, 4, 0]}>
                {[...DATA.teams].reverse().map((d, i) => <Cell key={i} fill={scoreColor(d.avg)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <Card>
          <SectionTitle icon="📋" title="Team Performance Table" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Rank", "Team", "Avg Score", "Audits", "Status", "Gap"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", color: C.muted, fontWeight: 600, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DATA.teams.map((t, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}20`, background: i % 2 === 0 ? C.surface + "60" : "transparent" }}>
                    <td style={{ padding: "10px 12px", color: i < 3 ? C.amber : C.muted, fontWeight: i < 3 ? 800 : 400 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </td>
                    <td style={{ padding: "10px 12px", color: C.text, fontWeight: 600 }}>{t.team}</td>
                    <td style={{ padding: "10px 12px", color: scoreColor(t.avg), fontWeight: 800 }}>{t.avg}%</td>
                    <td style={{ padding: "10px 12px", color: C.sub }}>{t.count}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <Badge label={t.avg >= 90 ? "On Target" : "Below Target"} color={t.avg >= 90 ? C.green : C.red} />
                    </td>
                    <td style={{ padding: "10px 12px", color: t.avg >= 90 ? C.green : C.red, fontWeight: 700 }}>
                      {t.avg >= 90 ? `+${(t.avg - 90).toFixed(1)}%` : `${(t.avg - 90).toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Agents Tab ────────────────────────────────────────────────────────────────
function AgentsTab() {
  const [view, setView] = useState("bottom");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 10 }}>
        {[["bottom", "⚠️ Needs Attention", C.red], ["top", "🏆 Star Performers", C.green]].map(([v, label, col]) => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? col + "20" : C.card,
            color: view === v ? col : C.sub,
            border: `1px solid ${view === v ? col : C.border}`,
            borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      {view === "bottom" && (
        <>
          <div style={{ background: C.red + "12", border: `1px solid ${C.red}40`, borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ color: C.red, fontWeight: 700, fontSize: 13 }}>🚨 Immediate Coaching Required</div>
            <div style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>
              These {DATA.bottom_agents.length} agents are significantly below the 90% quality target. Schedule 1:1 sessions and targeted training immediately.
            </div>
          </div>
          <Card>
            <SectionTitle icon="📉" title="Bottom 10 Agents by Quality Score" sub="Agents with ≥3 audits, lowest performing" />
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={DATA.bottom_agents} margin={{ left: 10, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="agent" tick={{ fill: C.sub, fontSize: 9 }} angle={-30} textAnchor="end" interval={0} height={60} />
                <YAxis domain={[0, 100]} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => v + "%"} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={90} stroke={C.cyan} strokeDasharray="5 5" label={{ value: "90%", fill: C.cyan, fontSize: 10 }} />
                <Bar dataKey="avg" name="Avg Score" radius={[4, 4, 0, 0]}>
                  {DATA.bottom_agents.map((_, i) => <Cell key={i} fill={C.red} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["Agent", "Avg Score", "Audits", "Gap to Target", "Priority"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", color: C.muted, fontWeight: 600, textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DATA.bottom_agents.map((a, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}20` }}>
                      <td style={{ padding: "10px 12px", color: C.text, fontWeight: 600 }}>{a.agent}</td>
                      <td style={{ padding: "10px 12px", color: C.red, fontWeight: 800 }}>{a.avg}%</td>
                      <td style={{ padding: "10px 12px", color: C.sub }}>{a.count}</td>
                      <td style={{ padding: "10px 12px", color: C.red, fontWeight: 700 }}>{(a.avg - 90).toFixed(1)}%</td>
                      <td style={{ padding: "10px 12px" }}>
                        <Badge label={a.avg < 60 ? "Urgent" : a.avg < 75 ? "High" : "Medium"} 
                               color={a.avg < 60 ? C.red : a.avg < 75 ? C.amber : C.amber} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {view === "top" && (
        <>
          <div style={{ background: C.green + "12", border: `1px solid ${C.green}40`, borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ color: C.green, fontWeight: 700, fontSize: 13 }}>🌟 Recognition & Best Practice Sharing</div>
            <div style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>
              These agents consistently deliver outstanding quality. Use their techniques as training benchmarks across all teams.
            </div>
          </div>
          <Card>
            <SectionTitle icon="🏆" title="Top 10 Agents by Quality Score" sub="Agents with ≥3 audits, highest performing" />
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={[...DATA.top_agents].reverse()} margin={{ left: 10, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="agent" tick={{ fill: C.sub, fontSize: 9 }} angle={-30} textAnchor="end" interval={0} height={60} />
                <YAxis domain={[88, 100]} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => v + "%"} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg" name="Avg Score" radius={[4, 4, 0, 0]}>
                  {DATA.top_agents.map((_, i) => <Cell key={i} fill={i === 0 ? C.amber : C.green} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["Rank", "Agent", "Avg Score", "Audits", "Above Target", "Award"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", color: C.muted, fontWeight: 600, textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DATA.top_agents.map((a, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}20` }}>
                      <td style={{ padding: "10px 12px", color: i < 3 ? C.amber : C.muted, fontWeight: 800 }}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </td>
                      <td style={{ padding: "10px 12px", color: C.text, fontWeight: 600 }}>{a.agent}</td>
                      <td style={{ padding: "10px 12px", color: C.green, fontWeight: 800 }}>{a.avg}%</td>
                      <td style={{ padding: "10px 12px", color: C.sub }}>{a.count}</td>
                      <td style={{ padding: "10px 12px", color: C.green, fontWeight: 700 }}>+{(a.avg - 90).toFixed(1)}%</td>
                      <td style={{ padding: "10px 12px" }}>
                        <Badge label={a.avg >= 96 ? "Elite" : "Star"} color={a.avg >= 96 ? C.amber : C.green} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Compliance Tab ────────────────────────────────────────────────────────────
function ComplianceTab() {
  const { kpis } = DATA;
  const sevData = [
    { name: "Low", value: kpis.low_count, color: C.green },
    { name: "Medium", value: kpis.medium_count, color: C.amber },
    { name: "Critical", value: kpis.critical_count, color: C.red },
  ];
  const fbData = [
    { name: "Done", value: kpis.fb_done, color: C.green },
    { name: "Pending", value: kpis.fb_pending, color: C.amber },
  ];
  const complianceRate = Math.round(kpis.fb_done / (kpis.fb_done + kpis.fb_pending) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <KpiTile label="Fatal Incidents" value={kpis.fatal_count} sub="Requires root cause analysis" icon="🚨" color={C.red} />
        <KpiTile label="Critical Issues" value={kpis.critical_count} sub="Escalate immediately" icon="🔴" color={C.red} />
        <KpiTile label="Feedback Compliance" value={`${complianceRate}%`} sub={`${kpis.fb_pending} still pending`} icon="📝" color={complianceRate >= 90 ? C.green : C.amber} />
        <KpiTile label="Fatal Rate" value={`${(kpis.fatal_count / kpis.total_audits * 100).toFixed(1)}%`} sub="Of total audited calls" icon="📊" color={C.red} />
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 300px" }}>
          <SectionTitle icon="⚠️" title="Issue Severity Breakdown" />
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={sevData} cx="50%" cy="45%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {sevData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ flex: "1 1 300px" }}>
          <SectionTitle icon="✅" title="Feedback Completion Status" />
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={fbData} cx="50%" cy="45%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {fbData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ flex: "1 1 260px" }}>
          <SectionTitle icon="🔥" title="Fatal Incidents by Team" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {DATA.fatal_by_team.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: C.red, fontWeight: 800, minWidth: 20, fontSize: 14 }}>{d.count}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.sub, fontSize: 11, marginBottom: 2 }}>{d.team}</div>
                  <div style={{ height: 5, background: C.border, borderRadius: 3 }}>
                    <div style={{ width: `${d.count / 6 * 100}%`, height: "100%", background: C.red, borderRadius: 3 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Critical Parameters */}
      <Card>
        <SectionTitle icon="🔍" title="Parameters Needing Immediate Attention" sub="Scored below 80% — critical coaching areas" />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          {DATA.params.filter(p => p.score < 80).map(p => (
            <div key={p.name} style={{
              background: C.red + "12", border: `1px solid ${C.red}40`,
              borderRadius: 10, padding: "14px 20px", minWidth: 180
            }}>
              <div style={{ color: C.red, fontSize: 24, fontWeight: 800 }}>{p.score}%</div>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginTop: 4 }}>{p.name}</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Gap: {(p.score - 90).toFixed(1)}%</div>
              <Sparkline value={p.score} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Auditors Tab ──────────────────────────────────────────────────────────────
function AuditorsTab() {
  const total = DATA.auditors.reduce((s, a) => s + a.count, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <KpiTile label="Active Auditors" value={DATA.auditors.length} sub="Quality team members" icon="👥" color={C.cyan} />
        <KpiTile label="Total Audits Done" value={total.toLocaleString()} sub="Across all auditors" icon="📁" color={C.purple} />
        <KpiTile label="Avg per Auditor" value={Math.round(total / DATA.auditors.length)} sub="Audits per person" icon="📊" color={C.amber} />
        <KpiTile label="Top Auditor" value={DATA.auditors[0]?.name.split(" ")[0]} sub={`${DATA.auditors[0]?.count} audits completed`} icon="🏆" color={C.green} />
      </div>

      <Card>
        <SectionTitle icon="👤" title="Auditor Workload Distribution" sub="Total audits completed by each QA analyst" />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={DATA.auditors} margin={{ bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Audits" radius={[4, 4, 0, 0]}>
              {DATA.auditors.map((_, i) => (
                <Cell key={i} fill={[C.cyan, C.purple, C.green, C.amber, C.red, C.cyan, C.purple][i % 7]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SectionTitle icon="📋" title="Auditor Details" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Auditor", "Audits Completed", "% of Total", "Workload Share", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", color: C.muted, fontWeight: 600, textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DATA.auditors.map((a, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}20`, background: i % 2 === 0 ? C.surface + "60" : "transparent" }}>
                  <td style={{ padding: "12px 14px", color: C.text, fontWeight: 600 }}>{a.name}</td>
                  <td style={{ padding: "12px 14px", color: C.cyan, fontWeight: 800 }}>{a.count}</td>
                  <td style={{ padding: "12px 14px", color: C.sub }}>{(a.count / total * 100).toFixed(1)}%</td>
                  <td style={{ padding: "12px 14px", minWidth: 140 }}>
                    <div style={{ height: 7, background: C.border, borderRadius: 4 }}>
                      <div style={{ width: `${a.count / DATA.auditors[0].count * 100}%`, height: "100%", background: C.cyan, borderRadius: 4 }} />
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <Badge label={a.count > 160 ? "Heavy" : a.count > 120 ? "Normal" : "Light"} 
                           color={a.count > 160 ? C.amber : C.green} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
export default function QMSDashboard() {
  const [tab, setTab] = useState(0);
  const tabContent = [<OverviewTab />, <ParametersTab />, <TeamsTab />, <AgentsTab />, <ComplianceTab />, <AuditorsTab />];

  const tabIcons = ["🏠", "📡", "🏅", "👤", "🛡️", "👥"];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 24px", position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, paddingBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `linear-gradient(135deg, ${C.cyan}, ${C.purple})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18
              }}>🎯</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>QMS Dashboard</div>
                <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Quality Management System</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ background: scoreColor(DATA.kpis.overall_avg) + "20", border: `1px solid ${scoreColor(DATA.kpis.overall_avg)}50`, borderRadius: 8, padding: "4px 14px", color: scoreColor(DATA.kpis.overall_avg), fontWeight: 800, fontSize: 13 }}>
                {DATA.kpis.overall_avg}% Overall
              </div>
              <div style={{ background: C.red + "20", border: `1px solid ${C.red}50`, borderRadius: 8, padding: "4px 14px", color: C.red, fontWeight: 700, fontSize: 12 }}>
                🚨 {DATA.kpis.fatal_count} Fatals
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 14px", color: C.sub, fontSize: 11 }}>
                {DATA.kpis.total_audits.toLocaleString()} audits
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, paddingTop: 6 }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)} style={{
                background: tab === i ? C.cyan + "15" : "transparent",
                color: tab === i ? C.cyan : C.muted,
                border: "none", borderBottom: tab === i ? `2px solid ${C.cyan}` : "2px solid transparent",
                padding: "8px 16px", fontSize: 12, fontWeight: tab === i ? 700 : 500,
                cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 5,
                borderRadius: "6px 6px 0 0", whiteSpace: "nowrap"
              }}>
                <span>{tabIcons[i]}</span> {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px" }}>
        {tabContent[tab]}
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 24px", textAlign: "center", color: C.muted, fontSize: 11 }}>
        Quality Management System  ·  {DATA.kpis.total_audits.toLocaleString()} Audits Analyzed  ·  {DATA.auditors.length} Auditors  ·  For Internal Use Only
      </div>
    </div>
  );
}
