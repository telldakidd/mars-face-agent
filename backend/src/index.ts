import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import express from "express";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { agentRouter }       from "./routes/agent.js";
import { authRouter }        from "./routes/auth.js";
import { agentConfigRouter } from "./routes/agentConfig.js";
import { agentSetupRouter }  from "./routes/agentSetup.js";
import { tradesRouter }      from "./routes/trades.js";
import { clientsRouter }     from "./routes/clients.js";
import { webhooksRouter }    from "./routes/webhooks.js";
import { basketbotRouter }   from "./routes/basketbot.js";
import { weatherbotRouter }  from "./routes/weatherbot.js";
import { phoneRouter }       from "./routes/phone.js";
import { provisioningRouter } from "./routes/provisioning.js";
import { billingRouter }     from "./routes/billing.js";
import { briefingRouter }    from "./routes/briefing.js";
import { avatarRouter }      from "./routes/avatar.js";
import { businessRouter }    from "./routes/business.js";
import { crmRouter }         from "./routes/crm.js";
import { expensesRouter }    from "./routes/expenses.js";
import { workflowsRouter }  from "./routes/workflows.js";
import { chatHistoryRouter } from "./routes/chatHistory.js";
import { notificationsRouter } from "./routes/notifications.js";
import { eaWebhooksRouter } from "./routes/ea-webhooks.js";
import { initWebSocket, broadcastAll } from "./websocket.js";
import { runDailyBriefings } from "./services/morning-briefing.js";
import { checkAndAlertCalendar } from "./services/economic-calendar.js";

const app  = express();
const PORT = parseInt(process.env.PORT || "4000", 10);

app.use(cors());
// Raw body for Stripe webhooks
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public client-facing live dashboard (no auth required)
app.use(express.static(path.join(__dirname, "../public")));
app.get("/live", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/live.html"));
});

// Routes
app.use("/api",              eaWebhooksRouter);   // EA webhook receiver (heartbeat, pamm_status, trade, settle)
app.use("/api/auth",         authRouter);
app.use("/api/agent-config", agentConfigRouter);
app.use("/api/agent-setup",  agentSetupRouter);
app.use("/api/agent",       agentRouter);
app.use("/api/agent/briefing", briefingRouter);
app.use("/api/trades",      tradesRouter);
app.use("/api/clients",     clientsRouter);
app.use("/api/webhooks",    webhooksRouter);
app.use("/api/basketbot",   basketbotRouter);
app.use("/api/weatherbot",  weatherbotRouter);
app.use("/api/phone",       phoneRouter);
app.use("/api/provision",   provisioningRouter);
app.use("/api/billing",     billingRouter);
app.use("/api/avatar",      avatarRouter);
app.use("/api/business",   businessRouter);
app.use("/api/crm",        crmRouter);
app.use("/api/expenses",   expensesRouter);
app.use("/api/chat",          chatHistoryRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/workflows",  workflowsRouter);

// HTTP server + WebSocket
const server = http.createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`[mars-agent] Server  http://localhost:${PORT}`);
  console.log(`[mars-agent] WebSocket  ws://localhost:${PORT}/ws`);
  scheduleDailyBriefings();
  scheduleCalendarChecks();
});

// ── Daily 7am briefing cron ────────────────────────────────────────────────────
function scheduleDailyBriefings() {
  const scheduleNext = () => {
    const now  = new Date();
    const next = new Date();
    next.setHours(7, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const ms = next.getTime() - now.getTime();
    console.log(`[cron] Morning briefings scheduled in ${Math.round(ms / 60000)} min`);
    setTimeout(async () => {
      console.log("[cron] Running morning briefings...");
      await runDailyBriefings().catch(console.error);
      broadcastAll({ type: "system", message: "Morning briefings sent" });
      scheduleNext(); // reschedule for tomorrow
    }, ms);
  };
  scheduleNext();

  // ── Weekly report — Sunday 8am ───────────────────────────────────────────────
  const scheduleWeekly = () => {
    const now  = new Date();
    const next = new Date();
    // Sunday = 0
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    next.setDate(now.getDate() + daysUntilSunday);
    next.setHours(8, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 7);
    const ms = next.getTime() - now.getTime();
    console.log(`[cron] Weekly report scheduled in ${Math.round(ms / 60000)} min`);
    setTimeout(async () => {
      console.log("[cron] Weekly report running...");
      await runDailyBriefings().catch(console.error);
      broadcastAll({ type: "system", message: "Weekly reports sent" });
      scheduleWeekly(); // reschedule for next Sunday
    }, ms);
  };
  scheduleWeekly();
}

// ── Hourly economic calendar check ────────────────────────────────────────────
function scheduleCalendarChecks() {
  const runAndSchedule = async () => {
    await checkAndAlertCalendar().catch(console.error);
    setTimeout(runAndSchedule, 60 * 60 * 1000); // every hour
  };
  // Start after 1 min to allow server to fully boot
  setTimeout(runAndSchedule, 60 * 1000);
  console.log("[cron] Economic calendar checks scheduled (hourly)");
}

export default app;
