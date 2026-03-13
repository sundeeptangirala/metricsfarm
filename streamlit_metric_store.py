"""
BankMetric Store — Streamlit Prototype (MVP)
=============================================
Digital Data Mart metrics: authoring, discovery, approval workflow, before/after diff.

Run: pip install streamlit pandas && streamlit run app.py
"""

import streamlit as st
import pandas as pd
import json
from datetime import datetime, timedelta
from hashlib import md5

# ── Page Config ──
st.set_page_config(
    page_title="BankMetric Store",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom Styling ──
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    html, body, [class*="css"] { font-family: 'Inter', sans-serif; }
    
    .main-header {
        background: linear-gradient(135deg, #1B2A4A 0%, #0D7377 100%);
        padding: 1.5rem 2rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
    }
    .main-header h1 { color: white; margin: 0; font-size: 1.8rem; }
    .main-header p { color: #B8D4E3; margin: 0.25rem 0 0 0; font-size: 0.95rem; }
    
    .metric-card {
        background: white;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 1.25rem;
        margin-bottom: 1rem;
        transition: box-shadow 0.2s;
    }
    .metric-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    
    .tier-badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
    }
    .tier-operational { background: #DBEAFE; color: #1E40AF; }
    .tier-experimental { background: #FEF3C7; color: #92400E; }
    
    .status-badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
    }
    .status-approved { background: #D1FAE5; color: #065F46; }
    .status-pending { background: #FEF3C7; color: #92400E; }
    .status-draft { background: #E2E8F0; color: #475569; }
    .status-rejected { background: #FEE2E2; color: #991B1B; }
    
    .quality-green { color: #059669; font-weight: 600; }
    .quality-amber { color: #D97706; font-weight: 600; }
    .quality-red { color: #DC2626; font-weight: 600; }
    
    .diff-added { background: #D1FAE5; padding: 4px 8px; border-radius: 4px; font-family: monospace; }
    .diff-removed { background: #FEE2E2; padding: 4px 8px; border-radius: 4px; font-family: monospace; text-decoration: line-through; }
    .diff-unchanged { background: #F8FAFC; padding: 4px 8px; border-radius: 4px; font-family: monospace; }
    
    div[data-testid="stSidebar"] { background: #F8FAFC; }
    
    .stTabs [data-baseweb="tab-list"] { gap: 8px; }
    .stTabs [data-baseweb="tab"] {
        padding: 8px 20px;
        border-radius: 8px 8px 0 0;
    }
</style>
""", unsafe_allow_html=True)

# ── Session State Init ──
if "metrics" not in st.session_state:
    st.session_state.metrics = {
        "digital_session_count": {
            "name": "digital_session_count",
            "display_name": "Digital Session Count",
            "domain": "Digital Banking",
            "tier": "Operational",
            "owner": "Digital Analytics Team",
            "status": "Approved",
            "version": 3,
            "description": "Total number of authenticated sessions across web and mobile banking platforms within a given period.",
            "sql": "SELECT\n  date_trunc('{time_grain}', session_start_ts) AS period,\n  channel,\n  COUNT(DISTINCT session_id) AS session_count\nFROM digital_datamart.sessions\nWHERE session_start_ts BETWEEN '{start_date}' AND '{end_date}'\n  AND is_authenticated = TRUE\nGROUP BY 1, 2",
            "source_view": "digital_datamart.sessions",
            "dimensions": ["channel (web, mobile_ios, mobile_android)", "product_area", "customer_segment", "region"],
            "quality_score": "Green",
            "last_computed": "2026-03-12 06:00 UTC",
            "created_date": "2025-09-15",
            "history": [
                {"version": 1, "date": "2025-09-15", "author": "J. Martinez", "change": "Initial definition", "status": "Approved"},
                {"version": 2, "date": "2025-11-02", "author": "J. Martinez", "change": "Added mobile_android channel split", "status": "Approved"},
                {"version": 3, "date": "2026-01-18", "author": "S. Patel", "change": "Filter to authenticated sessions only", "status": "Approved"},
            ],
        },
        "digital_conversion_rate": {
            "name": "digital_conversion_rate",
            "display_name": "Digital Conversion Rate",
            "domain": "Digital Banking",
            "tier": "Operational",
            "owner": "Product Analytics",
            "status": "Approved",
            "version": 2,
            "description": "Percentage of digital sessions that result in a completed product application or transaction, segmented by funnel step and product type.",
            "sql": "SELECT\n  date_trunc('{time_grain}', session_start_ts) AS period,\n  product_type,\n  funnel_step,\n  COUNT(DISTINCT CASE WHEN conversion_flag = TRUE THEN session_id END)::FLOAT\n    / NULLIF(COUNT(DISTINCT session_id), 0) AS conversion_rate\nFROM digital_datamart.funnel_events\nWHERE session_start_ts BETWEEN '{start_date}' AND '{end_date}'\nGROUP BY 1, 2, 3",
            "source_view": "digital_datamart.funnel_events",
            "dimensions": ["product_type (checking, savings, credit_card, personal_loan)", "funnel_step", "channel", "customer_segment"],
            "quality_score": "Green",
            "last_computed": "2026-03-12 06:00 UTC",
            "created_date": "2025-10-01",
            "history": [
                {"version": 1, "date": "2025-10-01", "author": "A. Chen", "change": "Initial definition", "status": "Approved"},
                {"version": 2, "date": "2026-02-10", "author": "A. Chen", "change": "Added funnel_step dimension for multi-step tracking", "status": "Approved"},
            ],
        },
        "app_crash_rate": {
            "name": "app_crash_rate",
            "display_name": "Mobile App Crash Rate",
            "domain": "Digital Banking",
            "tier": "Operational",
            "owner": "Mobile Engineering",
            "status": "Approved",
            "version": 1,
            "description": "Percentage of mobile app sessions that end in an application crash, segmented by OS, app version, and device category.",
            "sql": "SELECT\n  date_trunc('{time_grain}', session_start_ts) AS period,\n  os_type,\n  app_version,\n  COUNT(DISTINCT CASE WHEN crash_flag = TRUE THEN session_id END)::FLOAT\n    / NULLIF(COUNT(DISTINCT session_id), 0) AS crash_rate\nFROM digital_datamart.mobile_sessions\nWHERE session_start_ts BETWEEN '{start_date}' AND '{end_date}'\nGROUP BY 1, 2, 3",
            "source_view": "digital_datamart.mobile_sessions",
            "dimensions": ["os_type (ios, android)", "app_version", "device_category", "screen_name"],
            "quality_score": "Amber",
            "last_computed": "2026-03-12 06:00 UTC",
            "created_date": "2026-01-05",
            "history": [
                {"version": 1, "date": "2026-01-05", "author": "R. Kim", "change": "Initial definition", "status": "Approved"},
            ],
        },
        "digital_adoption_rate": {
            "name": "digital_adoption_rate",
            "display_name": "Digital Adoption Rate",
            "domain": "Digital Banking",
            "tier": "Operational",
            "owner": "Digital Strategy",
            "status": "Approved",
            "version": 2,
            "description": "Percentage of active customers who have logged into a digital channel (web or mobile) at least once in the trailing 90 days.",
            "sql": "SELECT\n  as_of_date,\n  customer_segment,\n  COUNT(DISTINCT CASE WHEN last_digital_login >= as_of_date - INTERVAL '90 days' THEN customer_id END)::FLOAT\n    / NULLIF(COUNT(DISTINCT customer_id), 0) AS adoption_rate\nFROM digital_datamart.customer_digital_activity\nWHERE account_status = 'active'\nGROUP BY 1, 2",
            "source_view": "digital_datamart.customer_digital_activity",
            "dimensions": ["customer_segment (retail, small_business, wealth)", "region", "age_band", "tenure_band"],
            "quality_score": "Green",
            "last_computed": "2026-03-12 06:00 UTC",
            "created_date": "2025-08-20",
            "history": [
                {"version": 1, "date": "2025-08-20", "author": "L. Thompson", "change": "Initial definition", "status": "Approved"},
                {"version": 2, "date": "2025-12-15", "author": "L. Thompson", "change": "Changed window from 30 to 90 days per business request", "status": "Approved"},
            ],
        },
        "feature_usage_rate": {
            "name": "feature_usage_rate",
            "display_name": "Feature Usage Rate",
            "domain": "Digital Banking",
            "tier": "Experimental",
            "owner": "Product Analytics",
            "status": "Pending Review",
            "version": 1,
            "description": "Tracks adoption of specific digital banking features (Zelle, mobile deposit, bill pay, etc.) as a percentage of active digital users.",
            "sql": "SELECT\n  date_trunc('{time_grain}', event_ts) AS period,\n  feature_name,\n  COUNT(DISTINCT customer_id)::FLOAT\n    / NULLIF((\n      SELECT COUNT(DISTINCT customer_id)\n      FROM digital_datamart.sessions s\n      WHERE s.session_start_ts BETWEEN '{start_date}' AND '{end_date}'\n    ), 0) AS usage_rate\nFROM digital_datamart.feature_events\nWHERE event_ts BETWEEN '{start_date}' AND '{end_date}'\nGROUP BY 1, 2",
            "source_view": "digital_datamart.feature_events",
            "dimensions": ["feature_name", "channel", "customer_segment", "is_first_use"],
            "quality_score": "Amber",
            "last_computed": "2026-03-11 06:00 UTC",
            "created_date": "2026-03-01",
            "history": [
                {"version": 1, "date": "2026-03-01", "author": "A. Chen", "change": "Initial definition — experimental", "status": "Pending Review"},
            ],
        },
        "digital_error_rate": {
            "name": "digital_error_rate",
            "display_name": "Digital Transaction Error Rate",
            "domain": "Digital Banking",
            "tier": "Operational",
            "owner": "Digital Operations",
            "status": "Draft",
            "version": 1,
            "description": "Percentage of attempted digital transactions (transfers, payments, deposits) that fail due to system errors, timeouts, or integration failures.",
            "sql": "-- DRAFT: needs validation against core banking error codes\nSELECT\n  date_trunc('{time_grain}', txn_attempt_ts) AS period,\n  txn_type,\n  error_category,\n  COUNT(DISTINCT CASE WHEN status = 'failed' THEN txn_id END)::FLOAT\n    / NULLIF(COUNT(DISTINCT txn_id), 0) AS error_rate\nFROM digital_datamart.transactions\nWHERE txn_attempt_ts BETWEEN '{start_date}' AND '{end_date}'\nGROUP BY 1, 2, 3",
            "source_view": "digital_datamart.transactions",
            "dimensions": ["txn_type (transfer, bill_pay, mobile_deposit, zelle)", "error_category", "channel"],
            "quality_score": "Red",
            "last_computed": "N/A",
            "created_date": "2026-03-10",
            "history": [
                {"version": 1, "date": "2026-03-10", "author": "M. Johnson", "change": "Initial draft — needs source validation", "status": "Draft"},
            ],
        },
    }

if "pending_changes" not in st.session_state:
    st.session_state.pending_changes = {
        "digital_session_count": {
            "author": "S. Patel",
            "submitted": "2026-03-11",
            "change_summary": "Add bounce rate calculation as a companion metric derived from session data",
            "old_sql": "SELECT\n  date_trunc('{time_grain}', session_start_ts) AS period,\n  channel,\n  COUNT(DISTINCT session_id) AS session_count\nFROM digital_datamart.sessions\nWHERE session_start_ts BETWEEN '{start_date}' AND '{end_date}'\n  AND is_authenticated = TRUE\nGROUP BY 1, 2",
            "new_sql": "SELECT\n  date_trunc('{time_grain}', session_start_ts) AS period,\n  channel,\n  COUNT(DISTINCT session_id) AS session_count,\n  COUNT(DISTINCT CASE WHEN page_view_count = 1 THEN session_id END)::FLOAT\n    / NULLIF(COUNT(DISTINCT session_id), 0) AS bounce_rate\nFROM digital_datamart.sessions\nWHERE session_start_ts BETWEEN '{start_date}' AND '{end_date}'\n  AND is_authenticated = TRUE\nGROUP BY 1, 2",
            "impact": ["Executive Digital Dashboard", "Monthly Digital Banking Report", "Product Team Tableau Workbook"],
        },
    }

if "current_user" not in st.session_state:
    st.session_state.current_user = "S. Patel"
if "current_role" not in st.session_state:
    st.session_state.current_role = "Metric Owner"


# ── Sidebar ──
with st.sidebar:
    st.markdown("### 👤 Current User")
    st.session_state.current_user = st.selectbox(
        "User",
        ["S. Patel", "A. Chen", "J. Martinez", "R. Kim", "L. Thompson", "M. Johnson"],
        label_visibility="collapsed",
    )
    st.session_state.current_role = st.selectbox(
        "Role",
        ["Metric Owner", "Metric Steward", "Reviewer", "Consumer (Read Only)"],
    )

    st.markdown("---")
    st.markdown("### 🏦 MVP Scope")
    st.markdown("""
    **Domain:** Digital Data Mart  
    **Tier Focus:** Operational & Experimental  
    **Metrics Onboarded:** 6  
    **Pending Reviews:** 1  
    """)

    st.markdown("---")
    st.markdown("### 📊 Health Summary")
    metrics = st.session_state.metrics
    total = len(metrics)
    green = sum(1 for m in metrics.values() if m["quality_score"] == "Green")
    amber = sum(1 for m in metrics.values() if m["quality_score"] == "Amber")
    red = sum(1 for m in metrics.values() if m["quality_score"] == "Red")
    st.markdown(f"🟢 **{green}** Green &nbsp; 🟡 **{amber}** Amber &nbsp; 🔴 **{red}** Red")


# ── Header ──
st.markdown("""
<div class="main-header">
    <h1>📊 BankMetric Store</h1>
    <p>Digital Data Mart — Unified Metric Platform (MVP)</p>
</div>
""", unsafe_allow_html=True)

# ── Main Tabs ──
tab_catalog, tab_author, tab_approvals, tab_graphql = st.tabs([
    "🔍 Metric Catalog",
    "✏️ Author / Edit Metric",
    "✅ Approval Queue",
    "🔌 GraphQL API",
])


# ══════════════════════════════════════════════
# TAB 1: METRIC CATALOG
# ══════════════════════════════════════════════
with tab_catalog:
    col_search, col_filter1, col_filter2 = st.columns([3, 1, 1])
    with col_search:
        search = st.text_input("🔍 Search metrics", placeholder="e.g. session, conversion, crash...")
    with col_filter1:
        tier_filter = st.selectbox("Tier", ["All", "Operational", "Experimental"])
    with col_filter2:
        status_filter = st.selectbox("Status", ["All", "Approved", "Pending Review", "Draft"])

    filtered = {k: v for k, v in metrics.items() if (
        (search.lower() in v["display_name"].lower() or search.lower() in v["description"].lower() or search == "") and
        (tier_filter == "All" or v["tier"] == tier_filter) and
        (status_filter == "All" or v["status"] == status_filter)
    )}

    for key, m in filtered.items():
        tier_class = "tier-operational" if m["tier"] == "Operational" else "tier-experimental"
        status_class = f"status-{m['status'].lower().replace(' ', '-').replace('pending-review', 'pending')}"
        quality_class = f"quality-{m['quality_score'].lower()}"
        quality_icon = {"Green": "🟢", "Amber": "🟡", "Red": "🔴"}[m["quality_score"]]

        with st.expander(f"**{m['display_name']}** — `{m['name']}`", expanded=False):
            c1, c2, c3, c4 = st.columns(4)
            c1.markdown(f"<span class='tier-badge {tier_class}'>{m['tier']}</span>", unsafe_allow_html=True)
            c2.markdown(f"<span class='status-badge {status_class}'>{m['status']}</span>", unsafe_allow_html=True)
            c3.markdown(f"{quality_icon} **Quality:** <span class='{quality_class}'>{m['quality_score']}</span>", unsafe_allow_html=True)
            c4.markdown(f"**v{m['version']}** · Owner: {m['owner']}")

            st.markdown(f"_{m['description']}_")
            st.markdown(f"**Source View:** `{m['source_view']}`")
            st.markdown(f"**Dimensions:** {', '.join(m['dimensions'])}")

            st.markdown("**Metric SQL:**")
            st.code(m["sql"], language="sql")

            st.markdown(f"**Last Computed:** {m['last_computed']}")

            # Version history
            st.markdown("**Version History:**")
            hist_df = pd.DataFrame(m["history"])
            st.dataframe(hist_df, use_container_width=True, hide_index=True)


# ══════════════════════════════════════════════
# TAB 2: AUTHOR / EDIT METRIC
# ══════════════════════════════════════════════
with tab_author:
    st.markdown("### Create or Edit a Metric Definition")
    st.markdown("_Define the metric logic, map it to a source view, and submit for review._")

    mode = st.radio("Mode", ["Create New Metric", "Edit Existing Metric"], horizontal=True)

    if mode == "Edit Existing Metric":
        selected_metric = st.selectbox(
            "Select metric to edit",
            options=list(metrics.keys()),
            format_func=lambda k: metrics[k]["display_name"],
        )
        m = metrics[selected_metric]
        default_name = m["name"]
        default_display = m["display_name"]
        default_desc = m["description"]
        default_sql = m["sql"]
        default_source = m["source_view"]
        default_tier = m["tier"]
        default_dims = ", ".join(m["dimensions"])
    else:
        default_name = ""
        default_display = ""
        default_desc = ""
        default_sql = "SELECT\n  date_trunc('{time_grain}', ...) AS period,\n  ...\nFROM digital_datamart.your_table\nWHERE ... BETWEEN '{start_date}' AND '{end_date}'\nGROUP BY 1"
        default_source = "digital_datamart."
        default_tier = "Experimental"
        default_dims = ""

    col1, col2 = st.columns(2)
    with col1:
        metric_name = st.text_input("Metric Key (snake_case)", value=default_name)
        display_name = st.text_input("Display Name", value=default_display)
        tier = st.selectbox("Tier", ["Operational", "Experimental"], index=0 if default_tier == "Operational" else 1)
    with col2:
        source_view = st.text_input("Source View", value=default_source)
        dimensions = st.text_input("Dimensions (comma-separated)", value=default_dims)
        owner = st.text_input("Owner", value=st.session_state.current_user)

    description = st.text_area("Description", value=default_desc, height=80)
    new_sql = st.text_area("Metric SQL", value=default_sql, height=250)

    # ── Before / After Diff ──
    if mode == "Edit Existing Metric" and new_sql != m["sql"]:
        st.markdown("---")
        st.markdown("### 🔄 Before / After Comparison")

        col_before, col_after = st.columns(2)
        with col_before:
            st.markdown("**BEFORE (Current v{}):**".format(m["version"]))
            st.code(m["sql"], language="sql")
        with col_after:
            st.markdown("**AFTER (Proposed v{}):**".format(m["version"] + 1))
            st.code(new_sql, language="sql")

        # Line-by-line diff
        st.markdown("**Line Diff:**")
        old_lines = m["sql"].splitlines()
        new_lines = new_sql.splitlines()
        max_lines = max(len(old_lines), len(new_lines))
        for i in range(max_lines):
            old_line = old_lines[i] if i < len(old_lines) else ""
            new_line = new_lines[i] if i < len(new_lines) else ""
            if old_line == new_line:
                st.markdown(f"<div class='diff-unchanged'>&nbsp; {new_line}</div>", unsafe_allow_html=True)
            else:
                if old_line:
                    st.markdown(f"<div class='diff-removed'>- {old_line}</div>", unsafe_allow_html=True)
                if new_line:
                    st.markdown(f"<div class='diff-added'>+ {new_line}</div>", unsafe_allow_html=True)

        # Impact analysis
        st.markdown("**📋 Impact Analysis:**")
        st.info("This metric is consumed by: **Executive Digital Dashboard**, **Monthly Digital Banking Report**, **Product Team Tableau Workbook**. These consumers will be notified upon approval.")

    # Submit
    st.markdown("---")
    col_submit, col_save = st.columns(2)
    with col_submit:
        if st.button("🚀 Submit for Review", type="primary", use_container_width=True):
            if metric_name and display_name and new_sql:
                st.success(f"✅ Metric `{metric_name}` submitted for review! Reviewers have been notified.")
            else:
                st.error("Please fill in all required fields.")
    with col_save:
        if st.button("💾 Save as Draft", use_container_width=True):
            if metric_name:
                st.info(f"💾 Metric `{metric_name}` saved as draft.")


# ══════════════════════════════════════════════
# TAB 3: APPROVAL QUEUE
# ══════════════════════════════════════════════
with tab_approvals:
    st.markdown("### Pending Approval Requests")

    pending = st.session_state.pending_changes
    if not pending:
        st.info("No pending changes to review.")
    else:
        for metric_key, change in pending.items():
            m = metrics.get(metric_key, {})
            st.markdown(f"#### 📝 Change Request: `{metric_key}` — {m.get('display_name', 'Unknown')}")

            c1, c2, c3 = st.columns(3)
            c1.markdown(f"**Author:** {change['author']}")
            c2.markdown(f"**Submitted:** {change['submitted']}")
            c3.markdown(f"**Current Version:** v{m.get('version', '?')}")

            st.markdown(f"**Change Summary:** {change['change_summary']}")

            st.markdown("---")
            st.markdown("### 🔄 Side-by-Side Diff")
            col_old, col_new = st.columns(2)
            with col_old:
                st.markdown("**CURRENT:**")
                st.code(change["old_sql"], language="sql")
            with col_new:
                st.markdown("**PROPOSED:**")
                st.code(change["new_sql"], language="sql")

            # Impact
            st.markdown("**Downstream Impact:**")
            for consumer in change["impact"]:
                st.markdown(f"- 📊 {consumer}")

            # Sample data comparison
            st.markdown("**Sample Data Comparison (last 7 days):**")
            sample_data = pd.DataFrame({
                "Date": pd.date_range("2026-03-05", periods=7),
                "Channel": ["web"] * 4 + ["mobile_ios"] * 3,
                "Session Count (Current)": [45200, 43800, 41500, 46100, 28900, 27600, 31200],
                "Session Count (Proposed)": [45200, 43800, 41500, 46100, 28900, 27600, 31200],
                "Bounce Rate (NEW)": [0.32, 0.34, 0.31, 0.29, 0.18, 0.19, 0.17],
            })
            st.dataframe(sample_data, use_container_width=True, hide_index=True)
            st.caption("Session counts remain identical. New bounce_rate column is additive — no breaking change to existing consumers.")

            # Approval actions
            st.markdown("---")
            col_approve, col_reject, col_comment = st.columns(3)
            with col_approve:
                if st.button("✅ Approve", type="primary", key=f"approve_{metric_key}", use_container_width=True):
                    st.success(f"✅ Change approved! `{metric_key}` will be updated to v{m.get('version', 0) + 1} effective immediately.")
            with col_reject:
                if st.button("❌ Reject", key=f"reject_{metric_key}", use_container_width=True):
                    st.warning(f"Change request for `{metric_key}` has been rejected. Author will be notified.")
            with col_comment:
                if st.button("💬 Request Changes", key=f"comment_{metric_key}", use_container_width=True):
                    st.info("Comment box would open here for inline feedback on specific lines.")


# ══════════════════════════════════════════════
# TAB 4: GRAPHQL API
# ══════════════════════════════════════════════
with tab_graphql:
    st.markdown("### GraphQL API Explorer")
    st.markdown("_Query governed metrics programmatically. All responses come from approved definitions only._")

    st.markdown("**Endpoint:** `https://bankmetric.internal.bank.com/graphql`")

    st.markdown("#### Example Queries")

    query_type = st.selectbox("Select a query template", [
        "Fetch a metric by name",
        "Browse the metric catalog",
        "Get metric version history",
        "Query with dimensions and filters",
    ])

    if query_type == "Fetch a metric by name":
        st.code("""query {
  metric(name: "digital_session_count", params: {
    asOfDate: "2026-03-12"
    timeGrain: DAILY
    dimensions: [
      { name: "channel", value: "web" }
    ]
  }) {
    period
    value
    qualityScore
    definitionVersion
  }
}""", language="graphql")

        st.markdown("**Response:**")
        st.json({
            "data": {
                "metric": [
                    {"period": "2026-03-12", "value": 45832, "qualityScore": "GREEN", "definitionVersion": 3},
                    {"period": "2026-03-11", "value": 44291, "qualityScore": "GREEN", "definitionVersion": 3},
                    {"period": "2026-03-10", "value": 42108, "qualityScore": "GREEN", "definitionVersion": 3},
                ]
            }
        })

    elif query_type == "Browse the metric catalog":
        st.code("""query {
  metricCatalog(domain: DIGITAL_BANKING, tier: OPERATIONAL) {
    name
    displayName
    description
    owner
    status
    qualityScore
    version
    dimensions { name, allowedValues }
  }
}""", language="graphql")

    elif query_type == "Get metric version history":
        st.code("""query {
  metricHistory(name: "digital_session_count") {
    versions {
      version
      effectiveDate
      author
      changeSummary
      sql
      status
    }
  }
}""", language="graphql")

    elif query_type == "Query with dimensions and filters":
        st.code("""query {
  metric(name: "digital_conversion_rate", params: {
    asOfDate: "2026-03-12"
    timeGrain: MONTHLY
    dimensions: [
      { name: "product_type", value: "credit_card" },
      { name: "funnel_step", value: "application_complete" }
    ]
  }) {
    period
    value
    qualityScore
  }
}""", language="graphql")

    st.markdown("---")
    st.markdown("#### Schema Introspection")
    st.code("""type Query {
  metric(name: String!, params: MetricParams!): [MetricResult!]!
  metricCatalog(domain: Domain, tier: Tier, status: Status): [MetricDefinition!]!
  metricHistory(name: String!, version: Int): MetricVersionHistory!
}

input MetricParams {
  asOfDate: Date!
  timeGrain: TimeGrain!
  dimensions: [DimensionFilter!]
  dateRange: DateRange
}

enum TimeGrain { DAILY, WEEKLY, MONTHLY, QUARTERLY }
enum Tier { OPERATIONAL, EXPERIMENTAL }
enum Domain { DIGITAL_BANKING, BRANCH_OPS, PRODUCT_MARKETING, CREDIT_COLLECTIONS }
enum Status { APPROVED, PENDING_REVIEW, DRAFT, REJECTED, DEPRECATED }

type MetricResult {
  period: Date!
  value: Float!
  dimensionValues: [DimensionValue!]
  qualityScore: QualityScore!
  definitionVersion: Int!
  computedAt: DateTime!
}

type MetricDefinition {
  name: String!
  displayName: String!
  description: String!
  domain: Domain!
  tier: Tier!
  owner: String!
  status: Status!
  version: Int!
  sql: String!
  sourceView: String!
  dimensions: [DimensionSpec!]!
  qualityScore: QualityScore!
  lastComputed: DateTime
  createdDate: Date!
}""", language="graphql")

    st.markdown("---")
    st.markdown("#### Integration Examples")

    integration = st.selectbox("Platform", ["Python / pandas", "Tableau", "PowerBI", "cURL"])

    if integration == "Python / pandas":
        st.code("""import requests
import pandas as pd

ENDPOINT = "https://bankmetric.internal.bank.com/graphql"
HEADERS = {"Authorization": "Bearer <token>"}

query = '''
query {
  metric(name: "digital_session_count", params: {
    asOfDate: "2026-03-12", timeGrain: DAILY,
    dimensions: [{ name: "channel", value: "web" }]
  }) { period, value }
}
'''

resp = requests.post(ENDPOINT, json={"query": query}, headers=HEADERS)
df = pd.DataFrame(resp.json()["data"]["metric"])
print(df)
""", language="python")

    elif integration == "Tableau":
        st.code("""# Tableau Web Data Connector config
# URL: https://bankmetric.internal.bank.com/graphql
# Authentication: OAuth2 Bearer Token
# Schema: auto-discovered via GraphQL introspection
#
# In Tableau:
# 1. Data → New Data Source → Web Data Connector
# 2. Enter GraphQL endpoint URL
# 3. Select metric and dimensions in the connector UI
# 4. Tableau will map the response to a flat table automatically
""", language="text")

    elif integration == "PowerBI":
        st.code("""// Power BI — Power Query M script
let
    url = "https://bankmetric.internal.bank.com/graphql",
    body = "{""query"": ""{ metric(name: \\""digital_session_count\\"", params: { asOfDate: \\""2026-03-12\\"", timeGrain: DAILY }) { period, value } }""}",
    response = Web.Contents(url, [Content=Text.ToBinary(body), Headers=[#"Content-Type"="application/json"]]),
    json = Json.Document(response),
    data = json[data][metric],
    table = Table.FromList(data, Splitter.SplitByNothing(), null, null, ExtraValues.Error)
in
    table
""", language="text")

    elif integration == "cURL":
        st.code("""curl -X POST https://bankmetric.internal.bank.com/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{
    "query": "{ metric(name: \\"digital_session_count\\", params: { asOfDate: \\"2026-03-12\\", timeGrain: DAILY }) { period, value, qualityScore } }"
  }'
""", language="bash")
