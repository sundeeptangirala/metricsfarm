import { useState } from "react";

// ── Architecture data ──
const LAYERS = [
  {
    id: "consumers",
    label: "CONSUMPTION LAYER",
    subtitle: "Metric Consumers",
    y: 0,
    color: "#0D7377",
    colorLight: "#E8F5F5",
    items: [
      { id: "tableau", label: "Tableau / PowerBI", icon: "📊", desc: "BI dashboards connected via GraphQL connector", x: 0 },
      { id: "notebooks", label: "Jupyter / Python", icon: "🐍", desc: "Data science notebooks querying metrics via Python SDK", x: 1 },
      { id: "react-ui", label: "BankMetric UI", icon: "⚛️", desc: "React catalog, authoring & approval interface", x: 2 },
      { id: "downstream", label: "ML Feature Store", icon: "🤖", desc: "Governed metrics as ML features via API", x: 3 },
      { id: "exec-dash", label: "Executive Mobile", icon: "📱", desc: "Mobile dashboard for C-suite metric views", x: 4 },
    ],
  },
  {
    id: "graphql",
    label: "API GATEWAY",
    subtitle: "GraphQL Federation Layer",
    y: 1,
    color: "#6D28D9",
    colorLight: "#EDE9FE",
    items: [
      { id: "apollo", label: "Apollo Gateway", icon: "🔮", desc: "Federated GraphQL gateway — single endpoint for all metric queries, schema stitching across subgraphs", x: 0, wide: true },
      { id: "auth", label: "Auth & RBAC", icon: "🔐", desc: "OAuth2 / mTLS + OPA policy engine — field-level authorization, row-level security, full audit logging", x: 1 },
    ],
  },
  {
    id: "services",
    label: "SERVICE LAYER",
    subtitle: "Java + Python Microservices",
    y: 2,
    color: "#1E40AF",
    colorLight: "#DBEAFE",
    items: [
      { id: "catalog-svc", label: "Catalog Service", icon: "☕", desc: "Java / Spring Boot — metric CRUD, versioning, search, deduplication engine, approval workflow state machine", x: 0, tech: "Java" },
      { id: "compute-svc", label: "Computation Service", icon: "🐍", desc: "Python — batch metric computation, SQL generation from definitions, Spark job orchestration, backfills", x: 1, tech: "Python" },
      { id: "quality-svc", label: "Quality Service", icon: "🐍", desc: "Python — freshness checks, cross-source reconciliation, tolerance monitoring, alerting via ServiceNow", x: 2, tech: "Python" },
      { id: "governance-svc", label: "Governance Service", icon: "☕", desc: "Java / Spring Boot — approval workflows, before/after diff generation, tiering rules, audit trail, notifications", x: 3, tech: "Java" },
    ],
  },
  {
    id: "storage",
    label: "STORAGE LAYER",
    subtitle: "Persistence & State",
    y: 3,
    color: "#92400E",
    colorLight: "#FEF3C7",
    items: [
      { id: "sqlserver-meta", label: "SQL Server — Metadata", icon: "🗄️", desc: "Metric definitions, versions, ownership, approval records, audit logs, quality check results", x: 0, tech: "SQL Server" },
      { id: "sqlserver-computed", label: "SQL Server — Computed", icon: "📦", desc: "Pre-computed metric results, materialized views, aggregation cache for common dimension combinations", x: 1, tech: "SQL Server" },
      { id: "git-repo", label: "Git Repository", icon: "📝", desc: "Version-controlled SQL definitions — full diff history, branch-based change proposals, merge on approval", x: 2, tech: "Git" },
      { id: "redis", label: "Redis Cache", icon: "⚡", desc: "Hot metric cache for frequently queried results, session state, rate limiting for API gateway", x: 3, tech: "Redis" },
    ],
  },
  {
    id: "sources",
    label: "SOURCE LAYER",
    subtitle: "Bank Data Sources (Upstream)",
    y: 4,
    color: "#991B1B",
    colorLight: "#FEE2E2",
    items: [
      { id: "digital-mart", label: "Digital Data Mart", icon: "🌐", desc: "Web & mobile analytics — sessions, conversions, feature events, crash logs (SQL Server)", x: 0, tech: "SQL Server" },
      { id: "core-banking", label: "Core Banking", icon: "🏦", desc: "FIS/Fiserv — accounts, transactions, customer master, product catalog", x: 1, tech: "SQL Server" },
      { id: "event-stream", label: "Event Stream", icon: "📡", desc: "Kafka — real-time clickstream, transaction events, app telemetry for near-real-time metrics", x: 2, tech: "Kafka" },
      { id: "edw", label: "Enterprise DW", icon: "🏗️", desc: "Consolidated warehouse — historical data, cross-domain joins, slowly changing dimensions", x: 3, tech: "SQL Server" },
    ],
  },
];

const CONNECTIONS = [
  // Consumers → GraphQL
  { from: "consumers", to: "graphql", label: "GraphQL queries", style: "solid" },
  // GraphQL → Services
  { from: "graphql", to: "services", label: "Resolvers delegate to services", style: "solid" },
  // Services → Storage
  { from: "services", to: "storage", label: "Read/write metric data", style: "solid" },
  // Services → Sources
  { from: "services", to: "sources", label: "Source view abstraction", style: "dashed" },
  // Storage ← Sources (ETL)
  { from: "sources", to: "storage", label: "Batch ETL / CDC", style: "dashed" },
];

const DETAIL_PANELS = {
  "catalog-svc": {
    title: "Catalog Service — Java / Spring Boot",
    sections: [
      { heading: "Responsibilities", items: ["Metric CRUD operations with optimistic locking", "Full-text search across definitions (Elasticsearch sidecar)", "Algorithmic deduplication — canonical SQL comparison", "Composite metric detection and dependency graph", "Version management with immutable history"] },
      { heading: "Key APIs (exposed to GraphQL)", items: ["POST /metrics — create definition", "PUT /metrics/{key}/versions — propose change", "GET /metrics/{key} — fetch with version history", "GET /metrics/search?q= — catalog search", "GET /metrics/{key}/lineage — upstream/downstream graph"] },
      { heading: "Tech Stack", items: ["Java 17+ / Spring Boot 3.x", "Spring Data JPA → SQL Server", "Apache Calcite — SQL parsing & column lineage", "Elasticsearch — metric search index"] },
    ],
  },
  "compute-svc": {
    title: "Computation Service — Python",
    sections: [
      { heading: "Responsibilities", items: ["Generate executable SQL from metric definitions + runtime params", "Orchestrate Spark batch jobs for pre-computation", "Schedule runs aligned with source freshness SLAs", "Backfill engine for historical recomputation on definition change", "Real-time metric computation via Kafka Streams (future)"] },
      { heading: "Key APIs", items: ["POST /compute/{key} — trigger on-demand computation", "POST /compute/batch — scheduled bulk computation", "POST /compute/{key}/backfill — recompute historical range", "GET /compute/{key}/status — job status and logs"] },
      { heading: "Tech Stack", items: ["Python 3.11+ / FastAPI", "SQLAlchemy — SQL Server connectivity", "Apache Spark (PySpark) — batch computation", "Airflow — job scheduling and orchestration", "Jinja2 — SQL template rendering"] },
    ],
  },
  "quality-svc": {
    title: "Quality Service — Python",
    sections: [
      { heading: "Quality Checks", items: ["Freshness — source data within declared SLA window", "Completeness — NULL/missing record detection", "Cross-source reconciliation — tolerance-based comparison", "Duplicate detection — primary key and composite key scans", "Tolerance monitoring — period-over-period anomaly detection"] },
      { heading: "Key APIs", items: ["POST /quality/{key}/run — trigger quality check suite", "GET /quality/{key}/score — current quality score (green/amber/red)", "GET /quality/{key}/history — quality score trend", "POST /quality/alerts/configure — set thresholds and notification rules"] },
      { heading: "Tech Stack", items: ["Python 3.11+ / FastAPI", "Great Expectations — quality check framework", "SQL Server queries for source validation", "ServiceNow / PagerDuty integration for alerting", "Prometheus metrics for quality SLA dashboards"] },
    ],
  },
  "governance-svc": {
    title: "Governance Service — Java / Spring Boot",
    sections: [
      { heading: "Responsibilities", items: ["Approval workflow state machine (Draft → Pending → Approved/Rejected)", "Before/after diff generation with SQL semantic comparison", "Impact analysis — identify all downstream consumers of a metric", "Tiering rule enforcement (Operational vs Experimental approval paths)", "Notification engine — email/Slack alerts to reviewers and consumers", "Full audit trail — every action timestamped with actor identity"] },
      { heading: "Key APIs", items: ["POST /governance/{key}/submit — submit change for review", "POST /governance/{key}/approve — approve pending change", "POST /governance/{key}/reject — reject with comments", "GET /governance/{key}/diff — before/after comparison", "GET /governance/{key}/impact — downstream consumer list", "GET /governance/queue — pending changes for current reviewer"] },
      { heading: "Tech Stack", items: ["Java 17+ / Spring Boot 3.x", "Spring State Machine — workflow orchestration", "Apache Calcite — SQL diff and semantic comparison", "Spring Mail + Slack SDK — notifications", "SQL Server — audit log persistence"] },
    ],
  },
  "apollo": {
    title: "Apollo GraphQL Gateway",
    sections: [
      { heading: "Architecture", items: ["Apollo Federation 2 — composes subgraphs from each service", "Single endpoint: /graphql for all metric operations", "Schema stitching across catalog, compute, quality, and governance", "Subscription support for real-time quality score updates (future)", "Request batching and query deduplication for dashboard performance"] },
      { heading: "Subgraphs", items: ["Catalog Subgraph → Catalog Service (Java)", "Compute Subgraph → Computation Service (Python)", "Quality Subgraph → Quality Service (Python)", "Governance Subgraph → Governance Service (Java)"] },
      { heading: "Tech Stack", items: ["Node.js / Apollo Server 4", "Apollo Gateway for federation routing", "DataLoader — batch and cache service calls", "GraphQL Shield — permission layer before resolvers"] },
    ],
  },
  "auth": {
    title: "Auth & RBAC Layer",
    sections: [
      { heading: "Authentication", items: ["OAuth2 / OpenID Connect for user authentication", "mTLS for service-to-service communication", "JWT tokens with metric-scope claims", "Active Directory / LDAP integration for bank SSO"] },
      { heading: "Authorization", items: ["Open Policy Agent (OPA) — declarative policy engine", "Field-level auth — sensitive metrics restricted by role", "Row-level security — regional managers see their region only", "Metric tier-based permissions (who can author/approve at each tier)"] },
      { heading: "Audit", items: ["Every GraphQL query logged: caller, timestamp, metric, params", "Approval actions logged with before/after state", "SOX-compliant audit trail with tamper-evident storage", "Exportable audit reports for examiner review"] },
    ],
  },
  "sqlserver-meta": {
    title: "SQL Server — Metadata Store",
    sections: [
      { heading: "Core Tables", items: ["metric_definitions — key, display_name, description, tier, status, owner", "metric_versions — version_id, metric_key, sql_logic, effective_date, author", "metric_dimensions — dimension specs, allowed values, constraints", "source_views — unified view definitions over source tables", "approval_records — change requests, reviewer actions, comments", "audit_log — all system actions with actor and timestamp"] },
      { heading: "Design Decisions", items: ["Immutable version history — no updates, only new versions", "Soft deletes with deprecated status for sunset metrics", "Optimistic locking on metric definitions for concurrent edits", "Partitioned audit log by month for query performance"] },
    ],
  },
  "sqlserver-computed": {
    title: "SQL Server — Computed Metric Store",
    sections: [
      { heading: "Core Tables", items: ["metric_results — metric_key, period, dimension_values (JSON), value, computed_at, definition_version", "materialized_views — pre-joined dimension tables for common query patterns", "aggregation_cache — pre-computed rollups by time grain (daily→monthly→quarterly)"] },
      { heading: "Design Decisions", items: ["Partitioned by period (monthly) for fast range queries", "Columnstore indexes on metric_results for analytical workloads", "Results tagged with definition_version for audit traceability", "TTL-based cache eviction for hot vs. cold metric data"] },
    ],
  },
};

// ── Component ──
export default function ArchitectureDiagram() {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const detail = selectedItem ? DETAIL_PANELS[selectedItem] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: "#E2E8F0", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{ padding: "28px 40px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1400, margin: "0 auto" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #0D7377, #6D28D9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>◈</div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>BankMetric Store</h1>
              <span style={{ background: "rgba(109,40,217,0.2)", color: "#A78BFA", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, letterSpacing: 0.5 }}>ARCHITECTURE</span>
            </div>
            <p style={{ margin: "6px 0 0 48px", fontSize: 12, color: "#64748B" }}>Digital Data Mart MVP · SQL Server · Java + Python · GraphQL</p>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 11, color: "#64748B" }}>
            <span><span style={{ color: "#0D7377", fontWeight: 600 }}>●</span> Java Services</span>
            <span><span style={{ color: "#6D28D9", fontWeight: 600 }}>●</span> Python Services</span>
            <span><span style={{ color: "#92400E", fontWeight: 600 }}>●</span> SQL Server</span>
            <span style={{ color: "#475569" }}>Click any component for details →</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", maxWidth: 1400, margin: "0 auto", padding: "24px 40px", gap: 24 }}>
        {/* ── Main Diagram ── */}
        <div style={{ flex: showDetail ? "0 0 58%" : 1, transition: "all 0.3s ease" }}>
          {LAYERS.map((layer, li) => (
            <div key={layer.id} style={{ marginBottom: li < LAYERS.length - 1 ? 8 : 0 }}>
              {/* Layer header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, paddingLeft: 4 }}>
                <div style={{ width: 3, height: 20, borderRadius: 2, background: layer.color }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: layer.color, textTransform: "uppercase" }}>{layer.label}</span>
                <span style={{ fontSize: 11, color: "#64748B" }}>— {layer.subtitle}</span>
              </div>

              {/* Items */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {layer.items.map(item => {
                  const isHovered = hoveredItem === item.id;
                  const isSelected = selectedItem === item.id;
                  const hasDetail = !!DETAIL_PANELS[item.id];
                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoveredItem(item.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={() => {
                        if (hasDetail) {
                          setSelectedItem(isSelected ? null : item.id);
                          setShowDetail(!isSelected);
                        }
                      }}
                      style={{
                        flex: item.wide ? "1 1 50%" : "1 1 0",
                        minWidth: item.wide ? 300 : 140,
                        background: isSelected ? `${layer.color}15` : isHovered ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isSelected ? layer.color + "60" : isHovered ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
                        borderRadius: 10,
                        padding: "14px 16px",
                        cursor: hasDetail ? "pointer" : "default",
                        transition: "all 0.15s ease",
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#F1F5F9" }}>{item.label}</span>
                            {item.tech && (
                              <span style={{
                                fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                                background: item.tech === "Java" ? "rgba(30,64,175,0.2)" : item.tech === "Python" ? "rgba(13,115,119,0.2)" : item.tech === "SQL Server" ? "rgba(146,64,14,0.2)" : item.tech === "Redis" ? "rgba(220,38,38,0.15)" : item.tech === "Kafka" ? "rgba(5,150,105,0.15)" : "rgba(255,255,255,0.08)",
                                color: item.tech === "Java" ? "#93AAFD" : item.tech === "Python" ? "#5EEAD4" : item.tech === "SQL Server" ? "#FBBF24" : item.tech === "Redis" ? "#FCA5A5" : item.tech === "Kafka" ? "#6EE7B7" : "#94A3B8",
                              }}>{item.tech}</span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: 10.5, color: "#64748B", lineHeight: 1.45 }}>{item.desc}</p>
                        </div>
                      </div>
                      {hasDetail && (
                        <div style={{ position: "absolute", top: 8, right: 10, fontSize: 10, color: isSelected ? layer.color : "#475569", transition: "color 0.15s" }}>
                          {isSelected ? "◆" : "◇"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Connection arrow between layers */}
              {li < LAYERS.length - 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 0" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    {CONNECTIONS.filter(c => c.from === layer.id || c.to === LAYERS[li + 1]?.id).slice(0, 1).map((conn, ci) => (
                      <div key={ci} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.12)", borderLeft: conn.style === "dashed" ? "1px dashed rgba(255,255,255,0.15)" : "none" }} />
                        <span style={{ fontSize: 9, color: "#475569", fontWeight: 500, padding: "2px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>{conn.label}</span>
                        <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid rgba(255,255,255,0.15)", marginTop: 2 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ── Data Flow Legend ── */}
          <div style={{ marginTop: 24, padding: "16px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>Data Flow Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Query Path", desc: "Consumer → GraphQL → Service → SQL Server → Response", color: "#0D7377" },
                { label: "Authoring Path", desc: "UI → Catalog Svc → Git + SQL Server → Governance Svc → Approval", color: "#6D28D9" },
                { label: "Computation Path", desc: "Scheduler → Compute Svc → Source SQL → Computed Store → Cache", color: "#1E40AF" },
                { label: "Quality Path", desc: "Cron → Quality Svc → Source checks → Score update → Alerts", color: "#D97706" },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ width: 3, height: 28, borderRadius: 2, background: f.color, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#CBD5E1" }}>{f.label}</div>
                    <div style={{ fontSize: 10, color: "#64748B", lineHeight: 1.4 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Detail Panel ── */}
        {showDetail && detail && (
          <div style={{
            flex: "0 0 40%",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 24,
            maxHeight: "calc(100vh - 180px)",
            overflow: "auto",
            position: "sticky",
            top: 100,
            animation: "slideIn 0.2s ease",
          }}>
            <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }`}</style>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#F1F5F9" }}>{detail.title}</h3>
              <button onClick={() => { setShowDetail(false); setSelectedItem(null); }}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#94A3B8", cursor: "pointer", padding: "4px 8px", fontSize: 12 }}>✕</button>
            </div>

            {detail.sections.map((section, si) => (
              <div key={si} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{section.heading}</div>
                {section.items.map((item, ii) => (
                  <div key={ii} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "#475569", fontSize: 10, marginTop: 3, flexShrink: 0 }}>▸</span>
                    <span style={{ fontSize: 12, color: "#CBD5E1", lineHeight: 1.5, fontFamily: item.startsWith("POST") || item.startsWith("GET") || item.startsWith("PUT") ? "'JetBrains Mono', monospace" : "inherit", fontSize: item.startsWith("POST") || item.startsWith("GET") || item.startsWith("PUT") ? 11 : 12 }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
