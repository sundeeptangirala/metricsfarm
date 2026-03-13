import { useState, useMemo, useCallback } from "react";
import { Search, ChevronDown, ChevronRight, Check, X, Clock, Edit3, Eye, Code, GitBranch, Shield, AlertTriangle, Activity, Users, Zap, ArrowRight, ArrowLeft, Plus, Filter, BarChart3 } from "lucide-react";

// ── Sample Data ──
const METRICS = [
  {
    key: "digital_session_count", name: "Digital Session Count", domain: "Digital Banking",
    tier: "Operational", owner: "Digital Analytics Team", ownerInitials: "DA", status: "Approved", version: 3,
    qualityScore: "green",
    description: "Total authenticated sessions across web and mobile banking platforms within a given period.",
    sql: `SELECT\n  date_trunc('{time_grain}', session_start_ts) AS period,\n  channel,\n  COUNT(DISTINCT session_id) AS session_count\nFROM digital_datamart.sessions\nWHERE session_start_ts BETWEEN '{start_date}' AND '{end_date}'\n  AND is_authenticated = TRUE\nGROUP BY 1, 2`,
    sourceView: "digital_datamart.sessions",
    dimensions: ["channel", "product_area", "customer_segment", "region"],
    lastComputed: "2026-03-12 06:00 UTC", consumers: 14,
    history: [
      { v: 3, date: "2026-01-18", author: "S. Patel", change: "Filter to authenticated sessions only", status: "Approved" },
      { v: 2, date: "2025-11-02", author: "J. Martinez", change: "Added mobile_android channel split", status: "Approved" },
      { v: 1, date: "2025-09-15", author: "J. Martinez", change: "Initial definition", status: "Approved" },
    ],
  },
  {
    key: "digital_conversion_rate", name: "Digital Conversion Rate", domain: "Digital Banking",
    tier: "Operational", owner: "Product Analytics", ownerInitials: "PA", status: "Approved", version: 2,
    qualityScore: "green",
    description: "Percentage of digital sessions resulting in a completed product application or transaction.",
    sql: `SELECT\n  date_trunc('{time_grain}', session_start_ts) AS period,\n  product_type,\n  funnel_step,\n  COUNT(DISTINCT CASE WHEN conversion_flag = TRUE THEN session_id END)::FLOAT\n    / NULLIF(COUNT(DISTINCT session_id), 0) AS conversion_rate\nFROM digital_datamart.funnel_events\nWHERE session_start_ts BETWEEN '{start_date}' AND '{end_date}'\nGROUP BY 1, 2, 3`,
    sourceView: "digital_datamart.funnel_events",
    dimensions: ["product_type", "funnel_step", "channel", "customer_segment"],
    lastComputed: "2026-03-12 06:00 UTC", consumers: 9,
    history: [
      { v: 2, date: "2026-02-10", author: "A. Chen", change: "Added funnel_step dimension", status: "Approved" },
      { v: 1, date: "2025-10-01", author: "A. Chen", change: "Initial definition", status: "Approved" },
    ],
  },
  {
    key: "app_crash_rate", name: "Mobile App Crash Rate", domain: "Digital Banking",
    tier: "Operational", owner: "Mobile Engineering", ownerInitials: "ME", status: "Approved", version: 1,
    qualityScore: "amber",
    description: "Percentage of mobile sessions ending in an application crash, by OS and app version.",
    sql: `SELECT\n  date_trunc('{time_grain}', session_start_ts) AS period,\n  os_type, app_version,\n  COUNT(DISTINCT CASE WHEN crash_flag = TRUE THEN session_id END)::FLOAT\n    / NULLIF(COUNT(DISTINCT session_id), 0) AS crash_rate\nFROM digital_datamart.mobile_sessions\nWHERE session_start_ts BETWEEN '{start_date}' AND '{end_date}'\nGROUP BY 1, 2, 3`,
    sourceView: "digital_datamart.mobile_sessions",
    dimensions: ["os_type", "app_version", "device_category", "screen_name"],
    lastComputed: "2026-03-12 06:00 UTC", consumers: 6,
    history: [{ v: 1, date: "2026-01-05", author: "R. Kim", change: "Initial definition", status: "Approved" }],
  },
  {
    key: "digital_adoption_rate", name: "Digital Adoption Rate", domain: "Digital Banking",
    tier: "Operational", owner: "Digital Strategy", ownerInitials: "DS", status: "Approved", version: 2,
    qualityScore: "green",
    description: "Percentage of active customers who logged into a digital channel in the trailing 90 days.",
    sql: `SELECT\n  as_of_date, customer_segment,\n  COUNT(DISTINCT CASE WHEN last_digital_login >= as_of_date - INTERVAL '90 days' THEN customer_id END)::FLOAT\n    / NULLIF(COUNT(DISTINCT customer_id), 0) AS adoption_rate\nFROM digital_datamart.customer_digital_activity\nWHERE account_status = 'active'\nGROUP BY 1, 2`,
    sourceView: "digital_datamart.customer_digital_activity",
    dimensions: ["customer_segment", "region", "age_band", "tenure_band"],
    lastComputed: "2026-03-12 06:00 UTC", consumers: 11,
    history: [
      { v: 2, date: "2025-12-15", author: "L. Thompson", change: "Changed window from 30 to 90 days", status: "Approved" },
      { v: 1, date: "2025-08-20", author: "L. Thompson", change: "Initial definition", status: "Approved" },
    ],
  },
  {
    key: "feature_usage_rate", name: "Feature Usage Rate", domain: "Digital Banking",
    tier: "Experimental", owner: "Product Analytics", ownerInitials: "PA", status: "Pending",
    version: 1, qualityScore: "amber",
    description: "Adoption of specific digital banking features (Zelle, mobile deposit, bill pay) as % of active digital users.",
    sql: `SELECT\n  date_trunc('{time_grain}', event_ts) AS period,\n  feature_name,\n  COUNT(DISTINCT customer_id)::FLOAT\n    / NULLIF((SELECT COUNT(DISTINCT customer_id)\n      FROM digital_datamart.sessions s\n      WHERE s.session_start_ts BETWEEN '{start_date}' AND '{end_date}'\n    ), 0) AS usage_rate\nFROM digital_datamart.feature_events\nWHERE event_ts BETWEEN '{start_date}' AND '{end_date}'\nGROUP BY 1, 2`,
    sourceView: "digital_datamart.feature_events",
    dimensions: ["feature_name", "channel", "customer_segment", "is_first_use"],
    lastComputed: "2026-03-11 06:00 UTC", consumers: 3,
    history: [{ v: 1, date: "2026-03-01", author: "A. Chen", change: "Initial definition — experimental", status: "Pending" }],
  },
  {
    key: "digital_error_rate", name: "Digital Transaction Error Rate", domain: "Digital Banking",
    tier: "Operational", owner: "Digital Operations", ownerInitials: "DO", status: "Draft",
    version: 1, qualityScore: "red",
    description: "Percentage of attempted digital transactions that fail due to system errors, timeouts, or integration failures.",
    sql: `-- DRAFT: needs validation against core banking error codes\nSELECT\n  date_trunc('{time_grain}', txn_attempt_ts) AS period,\n  txn_type, error_category,\n  COUNT(DISTINCT CASE WHEN status = 'failed' THEN txn_id END)::FLOAT\n    / NULLIF(COUNT(DISTINCT txn_id), 0) AS error_rate\nFROM digital_datamart.transactions\nWHERE txn_attempt_ts BETWEEN '{start_date}' AND '{end_date}'\nGROUP BY 1, 2, 3`,
    sourceView: "digital_datamart.transactions",
    dimensions: ["txn_type", "error_category", "channel"],
    lastComputed: "N/A", consumers: 0,
    history: [{ v: 1, date: "2026-03-10", author: "M. Johnson", change: "Initial draft — needs source validation", status: "Draft" }],
  },
];

const PENDING_CHANGE = {
  metricKey: "digital_session_count",
  author: "S. Patel",
  submitted: "2026-03-11",
  summary: "Add bounce rate calculation as companion metric derived from session data",
  oldSql: METRICS[0].sql,
  newSql: `SELECT\n  date_trunc('{time_grain}', session_start_ts) AS period,\n  channel,\n  COUNT(DISTINCT session_id) AS session_count,\n  COUNT(DISTINCT CASE WHEN page_view_count = 1 THEN session_id END)::FLOAT\n    / NULLIF(COUNT(DISTINCT session_id), 0) AS bounce_rate\nFROM digital_datamart.sessions\nWHERE session_start_ts BETWEEN '{start_date}' AND '{end_date}'\n  AND is_authenticated = TRUE\nGROUP BY 1, 2`,
  impact: ["Executive Digital Dashboard", "Monthly Digital Banking Report", "Product Team Tableau Workbook"],
};

// ── Design Tokens ──
const T = {
  navy: "#1B2A4A", teal: "#0D7377", tealLight: "#E8F5F5", gold: "#C49A2E",
  bg: "#F7F8FA", card: "#FFFFFF", border: "#E2E8F0", borderLight: "#F1F5F9",
  text: "#1E293B", textMid: "#475569", textLight: "#94A3B8",
  green: "#059669", greenBg: "#D1FAE5", amber: "#D97706", amberBg: "#FEF3C7",
  red: "#DC2626", redBg: "#FEE2E2", blueBg: "#DBEAFE", blue: "#1E40AF",
  purpleBg: "#EDE9FE", purple: "#6D28D9",
};

const QualityBadge = ({ score }) => {
  const map = { green: { bg: T.greenBg, color: T.green, label: "● Healthy" }, amber: { bg: T.amberBg, color: T.amber, label: "● Warning" }, red: { bg: T.redBg, color: T.red, label: "● Critical" } };
  const s = map[score] || map.green;
  return <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{s.label}</span>;
};

const StatusBadge = ({ status }) => {
  const map = { Approved: { bg: T.greenBg, color: T.green }, Pending: { bg: T.amberBg, color: T.amber }, Draft: { bg: T.borderLight, color: T.textMid }, Rejected: { bg: T.redBg, color: T.red } };
  const s = map[status] || map.Draft;
  return <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{status}</span>;
};

const TierBadge = ({ tier }) => {
  const isOp = tier === "Operational";
  return <span style={{ background: isOp ? T.blueBg : T.purpleBg, color: isOp ? T.blue : T.purple, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{tier}</span>;
};

const CodeBlock = ({ code, highlight }) => (
  <pre style={{ background: "#0F172A", color: "#E2E8F0", padding: 16, borderRadius: 8, fontSize: 12.5, lineHeight: 1.6, overflow: "auto", margin: 0, fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
    {highlight ? code.split("\n").map((line, i) => {
      const isAdd = line.startsWith("+");
      const isRemove = line.startsWith("-");
      return <div key={i} style={{ background: isAdd ? "rgba(5,150,105,0.2)" : isRemove ? "rgba(220,38,38,0.2)" : "transparent", padding: "0 4px", marginLeft: -4, marginRight: -4 }}>{line}</div>;
    }) : code}
  </pre>
);

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px", flex: 1 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <div style={{ background: accent + "18", borderRadius: 8, padding: 6, display: "flex" }}>
        <Icon size={16} color={accent} />
      </div>
      <span style={{ fontSize: 12, color: T.textLight, fontWeight: 500 }}>{label}</span>
    </div>
    <div style={{ fontSize: 24, fontWeight: 700, color: T.text }}>{value}</div>
  </div>
);

// ── Main App ──
export default function MetricStore() {
  const [activeTab, setActiveTab] = useState("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedMetric, setExpandedMetric] = useState(null);
  const [detailView, setDetailView] = useState(null);
  const [approvalAction, setApprovalAction] = useState(null);

  const filteredMetrics = useMemo(() => {
    return METRICS.filter(m => {
      const matchSearch = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.key.includes(searchQuery.toLowerCase()) || m.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTier = tierFilter === "All" || m.tier === tierFilter;
      const matchStatus = statusFilter === "All" || m.status === statusFilter;
      return matchSearch && matchTier && matchStatus;
    });
  }, [searchQuery, tierFilter, statusFilter]);

  const tabs = [
    { id: "catalog", label: "Catalog", icon: Search },
    { id: "author", label: "Author", icon: Edit3 },
    { id: "approvals", label: "Approvals", icon: GitBranch, badge: 1 },
    { id: "api", label: "GraphQL API", icon: Code },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ background: `linear-gradient(135deg, ${T.navy} 0%, #1a3a5c 50%, ${T.teal} 100%)`, padding: "24px 32px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <BarChart3 size={28} color="#fff" />
                <h1 style={{ margin: 0, color: "#fff", fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>BankMetric</h1>
                <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>MVP</span>
              </div>
              <p style={{ margin: "4px 0 0 40px", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Digital Data Mart · Unified Metric Platform</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.teal, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>SP</div>
                <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500 }}>S. Patel</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
            {[
              { label: "Total Metrics", value: "6" },
              { label: "Approved", value: "4" },
              { label: "Pending Review", value: "1" },
              { label: "Quality Green", value: "3/6" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 500 }}>{s.label}</span>
                <span style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 0 }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ background: "none", border: "none", borderBottom: active ? `2px solid ${T.teal}` : "2px solid transparent", padding: "14px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: active ? T.teal : T.textMid, fontWeight: active ? 600 : 400, fontSize: 13, transition: "all 0.15s" }}>
                <Icon size={16} />
                {tab.label}
                {tab.badge && <span style={{ background: T.red, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{tab.badge}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 32px" }}>

        {/* ══ CATALOG ══ */}
        {activeTab === "catalog" && (
          <div>
            {/* Search + Filters */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Search size={16} color={T.textLight} style={{ position: "absolute", left: 12, top: 11 }} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search metrics by name, key, or description..."
                  style={{ width: "100%", padding: "10px 12px 10px 36px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: T.card }} />
              </div>
              <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
                style={{ padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, background: T.card, color: T.text, cursor: "pointer" }}>
                <option>All</option><option>Operational</option><option>Experimental</option>
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, background: T.card, color: T.text, cursor: "pointer" }}>
                <option>All</option><option>Approved</option><option>Pending</option><option>Draft</option>
              </select>
            </div>

            {/* Metric List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredMetrics.map(m => {
                const isExpanded = expandedMetric === m.key;
                return (
                  <div key={m.key} style={{ background: T.card, border: `1px solid ${isExpanded ? T.teal + "40" : T.border}`, borderRadius: 10, overflow: "hidden", transition: "all 0.15s" }}>
                    {/* Row Header */}
                    <div onClick={() => setExpandedMetric(isExpanded ? null : m.key)}
                      style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
                      {isExpanded ? <ChevronDown size={16} color={T.textLight} /> : <ChevronRight size={16} color={T.textLight} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{m.name}</span>
                          <code style={{ fontSize: 11, color: T.textLight, background: T.borderLight, padding: "1px 6px", borderRadius: 4 }}>{m.key}</code>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: T.textMid, lineHeight: 1.4 }}>{m.description}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <TierBadge tier={m.tier} />
                        <StatusBadge status={m.status} />
                        <QualityBadge score={m.qualityScore} />
                        <span style={{ fontSize: 11, color: T.textLight, marginLeft: 4 }}>v{m.version}</span>
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${T.border}`, padding: 20, background: T.bg }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                          <div><span style={{ fontSize: 11, color: T.textLight, display: "block" }}>Owner</span><span style={{ fontSize: 13, fontWeight: 500 }}>{m.owner}</span></div>
                          <div><span style={{ fontSize: 11, color: T.textLight, display: "block" }}>Source View</span><code style={{ fontSize: 12 }}>{m.sourceView}</code></div>
                          <div><span style={{ fontSize: 11, color: T.textLight, display: "block" }}>Last Computed</span><span style={{ fontSize: 13 }}>{m.lastComputed}</span></div>
                          <div><span style={{ fontSize: 11, color: T.textLight, display: "block" }}>Consumers</span><span style={{ fontSize: 13, fontWeight: 600 }}>{m.consumers} downstream</span></div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <span style={{ fontSize: 11, color: T.textLight, display: "block", marginBottom: 6 }}>Dimensions</span>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {m.dimensions.map(d => <span key={d} style={{ background: T.card, border: `1px solid ${T.border}`, padding: "3px 10px", borderRadius: 6, fontSize: 12, color: T.textMid }}>{d}</span>)}
                          </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <span style={{ fontSize: 11, color: T.textLight, display: "block", marginBottom: 6 }}>Metric SQL</span>
                          <CodeBlock code={m.sql} />
                        </div>

                        <div>
                          <span style={{ fontSize: 11, color: T.textLight, display: "block", marginBottom: 6 }}>Version History</span>
                          <div style={{ background: T.card, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}` }}>
                            {m.history.map((h, i) => (
                              <div key={i} style={{ padding: "10px 16px", borderBottom: i < m.history.length - 1 ? `1px solid ${T.borderLight}` : "none", display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                                <span style={{ fontWeight: 600, color: T.teal, width: 28 }}>v{h.v}</span>
                                <span style={{ color: T.textLight, width: 80 }}>{h.date}</span>
                                <span style={{ color: T.textMid, width: 80 }}>{h.author}</span>
                                <span style={{ flex: 1, color: T.text }}>{h.change}</span>
                                <StatusBadge status={h.status} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ AUTHOR ══ */}
        {activeTab === "author" && (
          <div style={{ maxWidth: 900 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>Author a Metric Definition</h2>
            <p style={{ fontSize: 13, color: T.textMid, marginBottom: 24 }}>Define the metric logic, map to a source view, and submit for review.</p>

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: T.textMid, display: "block", marginBottom: 4 }}>Metric Key (snake_case)</label>
                  <input placeholder="e.g. digital_session_count" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: T.textMid, display: "block", marginBottom: 4 }}>Display Name</label>
                  <input placeholder="e.g. Digital Session Count" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: T.textMid, display: "block", marginBottom: 4 }}>Tier</label>
                  <select style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box", background: "#fff" }}>
                    <option>Operational</option><option>Experimental</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: T.textMid, display: "block", marginBottom: 4 }}>Source View</label>
                  <input placeholder="e.g. digital_datamart.sessions" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: T.textMid, display: "block", marginBottom: 4 }}>Description</label>
                <textarea rows={2} placeholder="Plain English description of what this metric measures and why it matters."
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: T.textMid, display: "block", marginBottom: 4 }}>Dimensions (comma-separated)</label>
                <input placeholder="e.g. channel, product_type, customer_segment" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: T.textMid, display: "block", marginBottom: 4 }}>Metric SQL</label>
                <textarea rows={10} placeholder={`SELECT\n  date_trunc('{time_grain}', ...) AS period,\n  ...\nFROM digital_datamart.your_table\nWHERE ... BETWEEN '{start_date}' AND '{end_date}'\nGROUP BY 1`}
                  style={{ width: "100%", padding: 14, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12.5, boxSizing: "border-box", resize: "vertical", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: "#0F172A", color: "#E2E8F0", lineHeight: 1.6 }} />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button style={{ background: T.teal, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <Zap size={14} /> Submit for Review
                </button>
                <button style={{ background: T.card, color: T.textMid, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  Save as Draft
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ APPROVALS ══ */}
        {activeTab === "approvals" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>Approval Queue</h2>
            <p style={{ fontSize: 13, color: T.textMid, marginBottom: 24 }}>Review pending metric definition changes with before/after comparison.</p>

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Change request header */}
              <div style={{ padding: 20, borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <GitBranch size={18} color={T.teal} />
                    <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>digital_session_count</span>
                    <span style={{ fontSize: 12, color: T.textLight }}>v3 → v4</span>
                  </div>
                  <StatusBadge status="Pending" />
                </div>
                <p style={{ margin: 0, fontSize: 13, color: T.textMid }}>{PENDING_CHANGE.summary}</p>
                <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: T.textLight }}>
                  <span>Author: <strong style={{ color: T.text }}>{PENDING_CHANGE.author}</strong></span>
                  <span>Submitted: {PENDING_CHANGE.submitted}</span>
                </div>
              </div>

              {/* Side-by-side diff */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ padding: 20, borderRight: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.red, marginBottom: 8, textTransform: "uppercase" }}>Current (v3)</div>
                  <CodeBlock code={PENDING_CHANGE.oldSql} />
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.green, marginBottom: 8, textTransform: "uppercase" }}>Proposed (v4)</div>
                  <CodeBlock code={PENDING_CHANGE.newSql} />
                </div>
              </div>

              {/* Impact Analysis */}
              <div style={{ padding: 20, borderBottom: `1px solid ${T.border}`, background: T.bg }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={14} color={T.amber} /> Downstream Impact
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PENDING_CHANGE.impact.map(c => (
                    <span key={c} style={{ background: T.amberBg, color: T.amber, padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500 }}>{c}</span>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: T.textMid, marginTop: 10, marginBottom: 0 }}>Session count values remain identical. New bounce_rate column is additive — no breaking change to existing consumers.</p>
              </div>

              {/* Actions */}
              <div style={{ padding: 20, display: "flex", gap: 12 }}>
                {approvalAction ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: approvalAction === "approved" ? T.greenBg : T.redBg, borderRadius: 8, fontSize: 13, fontWeight: 600, color: approvalAction === "approved" ? T.green : T.red }}>
                    {approvalAction === "approved" ? <><Check size={16} /> Approved — will be published as v4</> : <><X size={16} /> Rejected — author notified</>}
                  </div>
                ) : (
                  <>
                    <button onClick={() => setApprovalAction("approved")} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={14} /> Approve
                    </button>
                    <button onClick={() => setApprovalAction("rejected")} style={{ background: T.card, color: T.red, border: `1px solid ${T.red}40`, borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      <X size={14} /> Reject
                    </button>
                    <button style={{ background: T.card, color: T.textMid, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                      Request Changes
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ GRAPHQL API ══ */}
        {activeTab === "api" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>GraphQL API</h2>
            <p style={{ fontSize: 13, color: T.textMid, marginBottom: 24 }}>Consume governed metrics programmatically. All responses use approved definitions only.</p>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 16px" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.textLight }}>ENDPOINT</span>
              <code style={{ fontSize: 13, color: T.teal, fontWeight: 500 }}>https://bankmetric.internal.bank.com/graphql</code>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 10 }}>Example Query</h3>
                <CodeBlock code={`query {
  metric(
    name: "digital_session_count"
    params: {
      asOfDate: "2026-03-12"
      timeGrain: DAILY
      dimensions: [
        { name: "channel", value: "web" }
      ]
    }
  ) {
    period
    value
    qualityScore
    definitionVersion
  }
}`} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 10 }}>Response</h3>
                <CodeBlock code={JSON.stringify({
                  data: {
                    metric: [
                      { period: "2026-03-12", value: 45832, qualityScore: "GREEN", definitionVersion: 3 },
                      { period: "2026-03-11", value: 44291, qualityScore: "GREEN", definitionVersion: 3 },
                      { period: "2026-03-10", value: 42108, qualityScore: "GREEN", definitionVersion: 3 },
                    ]
                  }
                }, null, 2)} />
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 10 }}>Schema</h3>
              <CodeBlock code={`type Query {
  metric(name: String!, params: MetricParams!): [MetricResult!]!
  metricCatalog(domain: Domain, tier: Tier): [MetricDefinition!]!
  metricHistory(name: String!, version: Int): MetricVersionHistory!
}

input MetricParams {
  asOfDate: Date!
  timeGrain: TimeGrain!        # DAILY | MONTHLY | QUARTERLY
  dimensions: [DimensionFilter!]
}

enum TimeGrain { DAILY WEEKLY MONTHLY QUARTERLY }
enum Tier { OPERATIONAL EXPERIMENTAL }
enum Domain { DIGITAL_BANKING }

type MetricResult {
  period: Date!
  value: Float!
  qualityScore: QualityScore!
  definitionVersion: Int!
  computedAt: DateTime!
}`} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
