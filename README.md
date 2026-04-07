# Mars Face Agent

Autonomous face-to-face AI trading assistant with neon dashboard, mobile app, and device fleet management.

## Architecture

```
mars-face-agent/
├── apps/
│   ├── dashboard/          # Next.js 14 + Tailwind neon UI
│   │   ├── src/app/        # App Router pages + API routes
│   │   ├── src/components/ # NeonDashboard, ActivityFeed, TradeTable
│   │   └── src/lib/        # Supabase client/server helpers
│   └── mobile/             # Expo/React Native (Google Pixel)
│       ├── app/            # expo-router screens (tabs + auth)
│       └── src/            # Components, lib, types
├── backend/                # Express + TypeScript API server
│   ├── src/connectors/     # MT5 (MetaApi), TradingView, Polymarket
│   ├── src/services/       # RiskOps, TaskQueue
│   ├── src/routes/         # /agent, /trades, /clients, /webhooks
│   └── supabase/           # schema.sql (7 tables + RLS)
├── automation/             # n8n workflows + task runner
│   ├── workflows/          # daily-portfolio-scan, risk-monitor, tv-webhook
│   └── cron/               # task-runner.ts (polls task_queue)
├── briefs/                 # Product briefs
├── components/             # Shared reference components
└── docs/                   # System prompt, provisioning, security
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+              n   v
- Supabase project (free tier works)
- Expo CLI (`npm i -g expo-cli eas-cli`)

### 1. Clone and install

```bash
git clone <repo-url> && cd mars-face-agent
npm install            # installs all workspaces
```

### 2. Configure environment

```bash
# Copy env templates
cp .env.example .env
cp backend/.env.example backend/.env
cp apps/dashboard/.env.example apps/dashboard/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in your keys:

- **Supabase**: URL + service key (backend), anon key (dashboard)
- **MetaApi**: token + account ID (for MT5)
- **Polymarket**: API key + secret
- **OpenAI / Anthropic**: API keys for agent reasoning

### 3. Set up database

Run `backend/supabase/schema.sql` against your Supabase project:

- Go to Supabase Dashboard > SQL Editor > paste and run
- Creates 7 tables: `clients`, `dash_metrics`, `agent_activity`, `task_queue`, `trade_log`, `conversations`, `audit_log`
- Enables RLS with per-client isolation

### 4. Start development

```bash
# Backend + Dashboard together
npm run dev

# Or individually:
npm run dev:backend     # Express API on :4000
npm run dev:dashboard   # Next.js on :3000
npm run dev:mobile      # Expo dev server
```

### 5. Import n8n workflows

Import the JSON files from `automation/workflows/` into your n8n instance:

- `daily-portfolio-scan.json` — Daily 9AM portfolio summary + drawdown alerts
- `risk-monitor.json` — 15-minute risk threshold checks
- `tradingview-webhook.json` — TradingView alert → trade signal pipeline

### 6. Build mobile APK

```bash
cd apps/mobile
eas build --platform android --profile preview
# Produces .apk for sideloading onto Pixel devices
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/clients` | List all clients |
| GET | `/api/clients/:id` | Client + metrics |
| POST | `/api/clients` | Create client |
| GET | `/api/trades/:clientId` | Trade history |
| POST | `/api/trades` | Log a trade |
| POST | `/api/agent/log` | Log agent activity |
| POST | `/api/agent/escalate` | Trigger risk escalation |
| GET | `/api/agent/activity/:clientId` | Recent agent activity |
| POST | `/api/webhooks/tradingview` | TradingView alert receiver |
| POST | `/api/webhooks/polymarket` | Polymarket event receiver |

## Trading Connectors

| Connector | File | Status |
|-----------|------|--------|
| MT5 (MetaApi) | `backend/src/connectors/mt5.ts` | Mock stubs (plug in MetaApi SDK) |
| TradingView | `backend/src/connectors/tradingview.ts` | Webhook parser ready |
| Polymarket | `backend/src/connectors/polymarket.ts` | Mock stubs (plug in CLOB API) |

## Risk Controls

Defined in `backend/src/services/risk-ops.ts` and documented in `docs/security-risk-ops.md`:

- **Position sizing**: 2% (conservative), 5% (moderate), 10% (aggressive)
- **Daily drawdown stop**: -5% pauses all trading
- **Max concurrent positions**: 5 / 10 / 15 by tier
- **Single-asset exposure cap**: 25%
- **Trade cool-down**: 30 seconds between executions
- **Paper trading**: First 7 days per client

## Device Provisioning

See [docs/provisioning-guide.md](docs/provisioning-guide.md) for the complete 25-device fleet setup:

- Hardware checklist + Android configuration
- APK build and sideload via ADB
- Esper MDM enrollment + kiosk mode
- Per-device tracking spreadsheet
- Shipping package contents

## Security

See [docs/security-risk-ops.md](docs/security-risk-ops.md):

- HTTPS/TLS 1.3 on all endpoints
- JWT auth + Supabase RLS per-client isolation
- Audit logging on every agent action
- Incident response runbook (P0/P1/P2)
- Dead man's switch (30-min heartbeat)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Dashboard | Next.js 14, Tailwind, Recharts, Supabase SSR |
| Mobile | Expo 51, React Native, NativeWind, expo-router |
| Backend | Express, TypeScript, Zod, Supabase |
| Database | Supabase (Postgres) with RLS |
| Automation | n8n workflows, TypeScript task runner |
| AI | Claude (Anthropic) + GPT-4o (OpenAI) |
| Trading | MetaApi (MT5), TradingView webhooks, Polymarket CLOB |

## Notes

- All secrets in `.env` files (never committed)
- Connectors use mock data by default — swap in real API calls when keys are configured
- The mobile app uses `mars://` deep links for dashboard integration
- n8n workflows expect the backend running on `http://localhost:4000` by default
