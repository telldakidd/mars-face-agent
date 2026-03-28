# Project Brief — Autonomous Face-to-Face AI Agent (Mars Management)

## Overall Goal
Ship 25 Google Pixel phones preloaded with a face-to-face AI assistant that can autonomously manage client investments (MT5, TradingView, Polymarket) and pipe everything into a neon-style dashboard.

## Requirements Summary
- **On-device app (Pixel):** React Native/Expo APK with avatar/voice UI, connects to backend, runs scheduled tasks, supports push alerts.
- **Backend brain:** Claude/OpenAI for reasoning, Supabase (or similar) for data, n8n/worker for automation, task queue for scheduled jobs.
- **Dashboard:** Next.js + Tailwind, neon UI (cards, allocation chart, agent activity, face-to-face log). Per-client login.
- **Device management:** Preload APK, configure Android permissions/MDM, ship with instructions/login.

## Agent Capability Stack
1. **Market Intelligence:** MT5 feeds (MetaApi), TradingView webhooks, Polymarket GraphQL, optional news/weather.
2. **Strategy Engine:** SMC + indicator logic + Polymarket probability model, ensemble/voting, confidence thresholds.
3. **Risk/Cash Management:** Position sizing, daily drawdown stops, diversification rules, compliance guardrails.
4. **Execution:**
   - MT5 Expert Advisors or API bridge
   - TradingView → broker API automation
   - Polymarket API wallet trades
5. **Autonomy Supervisors:** Scheduler (cron/n8n), incident monitor, maintenance agent.
6. **Reporting:** Logged decisions, dashboard metrics, daily/weekly summaries.
7. **Security:** Central secret vault, per-client isolation, audit logs.

## Build Order
1. Define SOPs per platform (allowed trades, risk per client).
2. Create agent modules (MarketFeed, Signal, RiskOps, Execution, Monitor, Reporter).
3. Wire API bridges and test in paper accounts.
4. Backtest + validate logic.
5. Deploy with guardrails, then fully autonomous mode.

## Claude Action Items
- Scaffold backend (Supabase + n8n or Node service) with task queue + logging.
- Build Neon dashboard scaffold (Next.js) using provided component.
- Prototype Pixel app (Expo) that connects to backend and renders face agent UI.
- Integrate MT5/TradingView/Polymarket connectors (start with MT5 via MetaApi).
- Document provisioning steps for 25 devices (APK, MDM, credentials).
