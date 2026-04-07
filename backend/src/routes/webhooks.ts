import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import {
  parseAlert,
  validateSecret,
} from "../connectors/tradingview.js";
import { TaskQueueService } from "../services/task-queue.js";

export const webhooksRouter = Router();

const taskQueue = new TaskQueueService();

// ── Schemas ──────────────────────────────────────────────

const TradingViewBodySchema = z.object({
  passphrase: z.string(),
  ticker: z.string().optional(),
  exchange: z.string().optional(),
  bar: z.record(z.unknown()).optional(),
  strategy: z.record(z.unknown()).optional(),
}).passthrough();

const PolymarketEventSchema = z.object({
  event: z.string(),
  marketId: z.string().optional(),
  data: z.record(z.unknown()).optional(),
}).passthrough();

// ── POST /tradingview ────────────────────────────────────

webhooksRouter.post(
  "/tradingview",
  async (req: Request, res: Response) => {
    const secret = process.env.TRADINGVIEW_WEBHOOK_SECRET;

    if (!secret) {
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    // Validate the passphrase
    if (!validateSecret(req.body, secret)) {
      res.status(403).json({ error: "Invalid passphrase" });
      return;
    }

    const parsed = TradingViewBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    // Parse the alert into a structured signal
    const signal = parseAlert(req.body);

    // Enqueue as a task (use a default client ID for system-level alerts)
    const systemClientId =
      req.body.clientId ?? "00000000-0000-0000-0000-000000000000";

    const task = await taskQueue.enqueue(
      systemClientId,
      "tradingview_signal",
      { signal, rawBody: parsed.data },
      2 // high priority
    );

    // Audit log
    await supabase.from("audit_log").insert({
      client_id: systemClientId,
      event_type: "webhook_tradingview",
      detail: { signal, task_id: task?.id },
      ip_address: req.ip,
    });

    res.status(200).json({ received: true, signal, taskId: task?.id });
  }
);

// ── POST /polymarket ─────────────────────────────────────

webhooksRouter.post(
  "/polymarket",
  async (req: Request, res: Response) => {
    const parsed = PolymarketEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { event, marketId, data } = parsed.data;

    const systemClientId =
      req.body.clientId ?? "00000000-0000-0000-0000-000000000000";

    const task = await taskQueue.enqueue(
      systemClientId,
      "polymarket_event",
      { event, marketId, data },
      3
    );

    await supabase.from("audit_log").insert({
      client_id: systemClientId,
      event_type: "webhook_polymarket",
      detail: { event, market_id: marketId, task_id: task?.id },
      ip_address: req.ip,
    });

    res.status(200).json({ received: true, event, taskId: task?.id });
  }
);
