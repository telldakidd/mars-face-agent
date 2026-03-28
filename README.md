# Mars Face Agent – Starter Repo

This repo is the launch point for the face-to-face AI trading assistant + dashboard + device stack.

## Structure

```
apps/
  dashboard/      # Next.js neon UI
  mobile/         # Expo/React Native Pixel app
backend/          # Supabase / API / n8n definitions
automation/       # n8n workflows, cron jobs, task queue
briefs/           # Product + engineering briefs
components/       # Shared React components (e.g., neon dashboard)
docs/             # Prompts, SOPs, provisioning guides
```

### Included Now
- `briefs/polymarket-face-agent-brief.md` – full scope/spec.
- `components/neon-dashboard-ui.tsx` – Tailwind React component matching the neon UI reference.
- `docs/face-agent-system-prompt.md` – system prompt for the Pixel face agent.

## Next Steps
1. Clone the repo and open in VS Code with Claude Dev extension.
2. In Claude, run the build prompt referencing `briefs/polymarket-face-agent-brief.md`.
3. Start scaffolding:
   - `apps/dashboard`: Next.js 14 + Tailwind + Supabase client
   - `apps/mobile`: Expo app with face agent UI + secure auth
   - `backend`: Supabase schema, serverless functions, MT5/TradingView/Polymarket connectors
   - `automation`: n8n workflows for scheduling + monitoring
4. Commit early scaffolds and push.

## Tooling
- TypeScript everywhere
- Tailwind for web UI
- Expo (React Native) for Pixel app
- Supabase + n8n for backend/automation
- Claude/OpenAI APIs for reasoning

## Device Provisioning (outline)
- Build APK via Expo → sideload on Pixels
- Use Android Device Owner mode or MDM (Esper) to lock experience
- Load launcher + face agent + monitoring scripts

## Notes
- All secrets should stay in `.env.local` files (not committed)
- Keep `/docs` updated with SOPs for trading, risk, and escalation
- Use GitHub issues/projects to track features across dashboard/mobile/backend
