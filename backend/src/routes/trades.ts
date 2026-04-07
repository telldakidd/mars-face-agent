import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";

export const tradesRouter = Router();

// ── Schemas ──────────────────────────────────────────────

const CreateTradeSchema = z.object({
  clientId: z.string().uuid(),
  platform: z.string().min(1),
  symbol: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  qty: z.number().positive(),
  price: z.number().positive(),
  pnl: z.number().optional(),
  strategy: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  executedAt: z.string().datetime().optional(),
});

// ── GET /:clientId ───────────────────────────────────────

tradesRouter.get("/:clientId", async (req: Request, res: Response) => {
  const clientId = req.params.clientId;

  const { data, error } = await supabase
    .from("trade_log")
    .select("*")
    .eq("client_id", clientId)
    .order("executed_at", { ascending: false })
    .limit(100);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

// ── POST / ───────────────────────────────────────────────

tradesRouter.post("/", async (req: Request, res: Response) => {
  const parsed = CreateTradeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const {
    clientId,
    platform,
    symbol,
    side,
    qty,
    price,
    pnl,
    strategy,
    metadata,
    executedAt,
  } = parsed.data;

  const { data: trade, error: tradeErr } = await supabase
    .from("trade_log")
    .insert({
      client_id: clientId,
      platform,
      symbol,
      side,
      qty,
      price,
      pnl: pnl ?? null,
      strategy: strategy ?? null,
      metadata: metadata ?? {},
      executed_at: executedAt ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (tradeErr) {
    res.status(500).json({ error: tradeErr.message });
    return;
  }

  // Audit log
  await supabase.from("audit_log").insert({
    client_id: clientId,
    event_type: "trade_placed",
    detail: {
      trade_id: trade.id,
      platform,
      symbol,
      side,
      qty,
      price,
    },
    ip_address: req.ip,
  });

  res.status(201).json(trade);
});
