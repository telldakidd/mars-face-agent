import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { broadcastAll } from "../websocket.js";

export const eaWebhooksRouter = Router();

const HeartbeatSchema = z.object({
  bot:          z.string(),
  balance:      z.number(),
  equity:       z.number(),
  floating_pnl: z.number(),
});

const PammStatusSchema = z.object({
  bot:                  z.string(),
  equity:               z.number().optional(),
  balance:              z.number().optional(),
  floating_pnl:         z.number().optional(),
  hwm:                  z.number().optional(),
  dd_from_hwm_pct:      z.number().optional(),
  daily_pnl_pct:        z.number().optional(),
  weekly_pnl_pct:       z.number().optional(),
  monthly_pnl_pct:      z.number().optional(),
  positions:            z.number().optional(),
  buy_lots:             z.number().optional(),
  sell_lots:            z.number().optional(),
  net_exposure_pct:     z.number().optional(),
  phase:                z.string().optional(),
  kill_switch:          z.boolean().optional(),
  lot_reduction_active: z.boolean().optional(),
  daily_loss_pct:       z.number().optional(),
  trades_today:         z.number().optional(),
  total_trades:         z.number().optional(),
  total_wins:           z.number().optional(),
  win_rate:             z.number().optional(),
  base_lot_current:     z.number().optional(),
  timestamp:            z.string().optional(),
});

const TradeSchema = z.object({
  bot:      z.string(),
  symbol:   z.string(),
  side:     z.string().optional(),
  lots:     z.number().optional(),
  entry:    z.number().optional(),
  status:   z.string().optional(),
  category: z.string().optional(),
});

const SettleSchema = z.object({
  bot:        z.string(),
  symbol:     z.string(),
  status:     z.string().optional(),
  pnl:        z.number().optional(),
  exit_price: z.number().optional(),
});

// POST /api/heartbeat — lightweight keepalive from EA
eaWebhooksRouter.post("/heartbeat", async (req: Request, res: Response) => {
  const parsed = HeartbeatSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { bot, balance, equity, floating_pnl } = parsed.data;

  try {
    await supabase.from("basketbot_status").upsert(
      { bot, balance, equity, floating_pnl, last_heartbeat: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "bot" }
    );
  } catch (err) {
    console.error("[ea-webhooks] heartbeat db error:", err);
  }
  res.json({ ok: true });
});

// POST /api/pamm_status — full PAMM snapshot from EA
eaWebhooksRouter.post("/pamm_status", async (req: Request, res: Response) => {
  const parsed = PammStatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const data = parsed.data;

  try {
    await supabase.from("basketbot_status").upsert(
      { ...data, last_heartbeat: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "bot" }
    );
    broadcastAll({ type: "basketbot_status", ...data });
  } catch (err) {
    console.error("[ea-webhooks] pamm_status db error:", err);
  }
  res.json({ ok: true });
});

// POST /api/trade — trade opened by EA
eaWebhooksRouter.post("/trade", async (req: Request, res: Response) => {
  const parsed = TradeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { bot, symbol, side, lots, entry, category } = parsed.data;

  try {
    const { data } = await supabase.from("basketbot_trades").insert({
      bot, symbol, side, lots, entry, category, status: "open", opened_at: new Date().toISOString(),
    }).select("id").single();
    res.json({ ok: true, id: data?.id });
  } catch (err) {
    console.error("[ea-webhooks] trade insert error:", err);
    res.json({ ok: true });
  }
});

// POST /api/settle — trade closed by EA
eaWebhooksRouter.post("/settle", async (req: Request, res: Response) => {
  const parsed = SettleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { bot, symbol, pnl, exit_price } = parsed.data;

  try {
    // Find most recent open trade for this bot+symbol and close it
    const { data: open } = await supabase
      .from("basketbot_trades")
      .select("id")
      .eq("bot", bot)
      .eq("symbol", symbol)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .single();

    if (open?.id) {
      await supabase.from("basketbot_trades").update({
        exit_price, pnl, status: "closed", closed_at: new Date().toISOString(),
      }).eq("id", open.id);
    }
  } catch (err) {
    console.error("[ea-webhooks] settle error:", err);
  }
  res.json({ ok: true });
});
