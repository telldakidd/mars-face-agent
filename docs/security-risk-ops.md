# Security and Risk Operations

Comprehensive documentation of security architecture, trading risk controls, operational safeguards, compliance requirements, and incident response procedures for the Mars Agent platform.

---

## Architecture Security

### Transport Layer

All communication between clients, mobile apps, the dashboard, and the backend is encrypted in transit:

- TLS 1.3 enforced on all endpoints (TLS 1.2 accepted as fallback, TLS 1.1 and below rejected)
- HSTS headers with `max-age=31536000; includeSubDomains; preload`
- Certificate pinning in the mobile app for the backend API domain
- WebSocket connections (for real-time updates) upgrade from HTTPS and inherit TLS protection

### Authentication

- JWT-based authentication on every API endpoint
- Access tokens expire after 15 minutes; refresh tokens expire after 7 days
- Refresh token rotation: each use issues a new refresh token and invalidates the old one
- Password hashing: bcrypt with cost factor 12 (handled by Supabase Auth)
- Multi-factor authentication available for dashboard admin accounts
- Mobile devices authenticate via biometric + device-bound token stored in Android Keystore

### Per-Client Data Isolation

Supabase Row Level Security (RLS) policies ensure that:

- Clients can only read their own trades, positions, and reports
- Admin users have read access to all client data but write access is restricted to their assigned clients
- The agent service account uses the service role key and bypasses RLS only for cross-client operations (portfolio scans, risk monitoring)
- RLS policies are defined in `backend/supabase/migrations/` and applied via `supabase db push`

Example RLS policy:

```sql
CREATE POLICY "Clients can view own trades"
  ON trades
  FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Clients can view own positions"
  ON positions
  FOR SELECT
  USING (auth.uid() = client_id);
```

### Secrets Management

- All secrets stored in environment variables, never in source code
- Production secrets managed via the hosting platform's secret store (Vercel for dashboard, Fly.io/Railway for backend)
- `.env` files are in `.gitignore` and never committed
- API keys are rotated quarterly; rotation is tracked in the `secrets_rotation_log` table
- Service role keys are restricted to backend and automation services only

### Audit Logging

Every agent action is recorded in the `audit_log` table:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| task_id | uuid | Related task (nullable) |
| task_type | text | trade_execute, risk_check, report_generate, escalation |
| actor | text | system, agent, admin:{id}, client:{id} |
| action | text | Human-readable description of what happened |
| status | text | completed, failed |
| result | jsonb | Structured result data |
| error | text | Error message if failed |
| ip_address | inet | Source IP (for API calls) |
| duration_ms | integer | Execution time |
| created_at | timestamptz | When the action occurred |

Audit logs are:

- Append-only (no UPDATE or DELETE permissions for any role)
- Retained for 2 years minimum
- Exportable per client for compliance requests
- Indexed on `created_at`, `task_type`, and `actor` for query performance

---

## Trading Risk Controls

### Position Sizing by Client Tier

| Parameter | Conservative | Moderate | Aggressive |
|-----------|-------------|----------|------------|
| Max position size (% of portfolio) | 2% | 5% | 10% |
| Max concurrent open positions | 5 | 10 | 15 |
| Max single-asset exposure | 25% | 25% | 25% |
| Max sector concentration | 40% | 50% | 60% |
| Max leverage | 1x (none) | 2x | 3x |

Tier assignment is stored in the `clients.risk_tier` column and can only be changed by an admin through the dashboard (requires confirmation and is audit-logged).

### Daily Drawdown Stop

- If a client's portfolio drops by more than 5% from the day's opening value, all trading for that client is immediately paused
- The drawdown check runs continuously via the risk monitor workflow (every 15 minutes) and also before every trade execution in the task runner
- When triggered:
  1. `clients.trading_paused` is set to `true`
  2. All pending `trade_execute` tasks for that client are cancelled
  3. An escalation record is created with severity P1
  4. The admin is notified via the dashboard and Slack (if configured)
- Trading can only be resumed manually by an admin after reviewing the situation

### Trade Execution Safeguards

- **30-second cool-down**: After any trade executes, a minimum 30-second delay is enforced before the next trade for the same client. This prevents rapid-fire execution from compounding errors.
- **Duplicate detection**: If an identical signal (same symbol, side, and strategy) arrives within 5 minutes of a previous execution, it is flagged as a potential duplicate and held for manual review.
- **Price sanity check**: If the execution price deviates more than 2% from the signal price, the trade is flagged and paused.
- **Market hours enforcement**: Trades are only executed during the asset's market hours. Out-of-hours signals are queued for the next session open.

### Paper Trading Mode

- Every new client starts in paper trading mode for the first 7 calendar days
- Paper trades are recorded in the same `trades` table with `is_paper = true`
- PnL, drawdown, and risk metrics are calculated identically for paper and live trades
- After 7 days, an admin reviews the paper trading performance and can switch to live trading
- Clients can request to extend paper trading indefinitely

---

## Operational Risk

### Risk Monitor Workflow

The `risk-monitor.json` n8n workflow runs every 15 minutes and performs the following:

1. Fetches all active clients from the backend
2. For each client, evaluates:
   - Current drawdown vs. tier limit
   - Open position count vs. tier limit
   - Largest single position vs. 25% exposure limit
   - Daily PnL vs. daily loss limit
3. If any threshold is breached, triggers the escalation flow
4. If no breaches, logs an "all clear" status

### Escalation Flow

When a risk breach or anomaly is detected, the escalation flow proceeds through five stages:

```
Detect  -->  Log  -->  Pause Trading  -->  Notify Admin  -->  Await Manual Review
```

1. **Detect**: The risk monitor or task runner identifies a threshold breach
2. **Log**: The breach details are written to the `escalations` table and `audit_log`
3. **Pause Trading**: `clients.trading_paused` is set to `true` immediately
4. **Notify Admin**: Push notification to admin devices, Slack message, and dashboard banner
5. **Await Manual Review**: No automated action resumes trading; an admin must explicitly unpause

### Dead Man's Switch

A heartbeat mechanism ensures the system is actively monitoring:

- The task runner sends a heartbeat to the `system_heartbeat` table every 60 seconds
- The risk monitor workflow checks the last heartbeat timestamp on each run
- If the last heartbeat is older than 30 minutes:
  1. All clients' `trading_paused` is set to `true`
  2. A P0 escalation is created with reason `heartbeat_timeout`
  3. Admin is notified immediately

This ensures that if the task runner crashes, hangs, or loses connectivity, trading does not continue unsupervised.

### Manual Override

Admins always retain the ability to:

- Pause or resume trading for any client via the dashboard
- Cancel any pending task in the task queue
- Force-close any open position (triggers a market sell/buy to close)
- Override risk tier limits temporarily (logged with justification)
- Trigger an immediate portfolio scan outside the scheduled interval

Manual overrides are audit-logged with the admin's identity and stated reason.

---

## Compliance

### Trade Logging

Every trade execution record includes:

| Field | Description |
|-------|-------------|
| id | Unique trade identifier |
| client_id | Which client this trade belongs to |
| symbol | Traded instrument |
| side | buy or sell |
| quantity | Number of units |
| price | Execution price |
| strategy | Which strategy generated the signal |
| source | Origin: tradingview, manual, agent |
| rationale | AI-generated explanation of why this trade was taken |
| is_paper | Whether this was a paper trade |
| pnl | Realized profit/loss (updated on close) |
| created_at | When the trade was created |
| executed_at | When the trade was actually executed |
| closed_at | When the position was closed (nullable) |

### Client Consent

Before autonomous trading is enabled for any client:

1. The client signs a digital consent form (stored in `client_consents` table)
2. The consent form explicitly states:
   - Trading is performed by an AI agent
   - Risk parameters and tier limits
   - The client can pause trading at any time via the app
   - Past performance does not guarantee future results
3. Consent is timestamped and immutable (append-only table)
4. Consent can be revoked at any time, which immediately pauses all trading

### Audit Trail Export

Any client can request a full export of their audit trail:

- Request is submitted via the app or dashboard
- An admin triggers the export job, which generates a ZIP containing:
  - `trades.csv` - All trade records with timestamps
  - `escalations.csv` - All escalation events
  - `audit_log.csv` - All agent actions related to the client
  - `consents.csv` - Consent records
  - `reports.csv` - All generated reports
- The ZIP is encrypted with a one-time password and delivered via secure download link
- Export requests are themselves audit-logged

### Platform Restrictions

- Trading is conducted only on supported, regulated platforms (initially: Alpaca for US equities, MT5 for forex)
- No cryptocurrency trading without explicit regulatory review and client consent
- No margin trading for conservative-tier clients
- Geographic restrictions enforced based on client's jurisdiction

---

## Incident Response

### Severity Levels

| Level | Definition | Response Time | Examples |
|-------|-----------|---------------|----------|
| P0 | Immediate halt required | Within 5 minutes | Drawdown > 10%, unauthorized access detected, system compromise, data breach |
| P1 | Investigate and resolve urgently | Within 1 hour | Drawdown > 5%, single risk breach, task runner degraded, API errors > 5% |
| P2 | Address next business day | Within 24 hours | Non-critical bug, performance degradation, client feature request, cosmetic UI issue |

### P0 Triggers

The following events automatically trigger a P0 incident:

- Any client's drawdown exceeds 10% in a single day
- Unauthorized API access detected (invalid JWT with a valid client ID)
- Backend service is unreachable for more than 5 minutes
- Database integrity check fails
- Heartbeat timeout exceeds 30 minutes (dead man's switch)
- Multiple clients experience simultaneous risk breaches (possible systemic issue)

### Incident Runbook

**Step 1: Halt Trading**

```bash
# Via backend API (pauses ALL clients)
curl -X POST $BACKEND_URL/api/admin/halt-all \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"reason": "P0 incident: <description>", "initiated_by": "<admin-email>"}'
```

This sets `trading_paused = true` for every client and cancels all pending tasks.

**Step 2: Assess Scope**

- Check the `escalations` table for related events
- Review `audit_log` for the last 30 minutes of activity
- Check n8n execution history for workflow failures
- Verify backend health: `GET /api/health`
- Verify Supabase connectivity: check dashboard or run a test query

**Step 3: Notify Affected Clients**

- Identify affected clients from escalation records
- Send push notification via FCM: "Trading has been temporarily paused for your protection. Our team is investigating. No action needed on your part."
- For P0 events affecting all clients, use the bulk notification endpoint
- Log all notifications sent in the audit trail

**Step 4: Root Cause Analysis**

- Correlate timestamps across `audit_log`, `escalations`, and n8n execution history
- Check for external factors: market volatility events, API provider outages, network issues
- Document findings in the incident record
- Identify whether the issue is systemic (code bug, infrastructure failure) or isolated (single client, single trade)

**Step 5: Remediate**

- Deploy a fix if a code issue is identified (follow standard deployment process)
- If infrastructure-related, coordinate with hosting provider
- Resume trading per-client only after verifying:
  - The root cause is resolved
  - Risk thresholds are within normal bounds
  - The fix has been tested
- Each client's trading resumption is individually approved and audit-logged

### Post-Incident

- Incident report written within 48 hours
- Report includes: timeline, root cause, impact assessment, remediation steps, prevention measures
- Report shared with affected clients if requested
- Lessons learned incorporated into risk monitoring rules
- If a new risk scenario was discovered, add it to the risk monitor workflow

---

## Security Review Schedule

| Review | Frequency | Owner |
|--------|-----------|-------|
| Dependency audit (`npm audit`) | Weekly (automated) | CI pipeline |
| API key rotation | Quarterly | Admin |
| RLS policy review | Monthly | Backend lead |
| Penetration test | Annually | External vendor |
| Incident response drill | Semi-annually | Full team |
| Client data access review | Quarterly | Compliance lead |
| MDM policy review | Quarterly | Device management lead |
