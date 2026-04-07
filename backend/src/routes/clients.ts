import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";

export const clientsRouter = Router();

// ── Schemas ──────────────────────────────────────────────

const CreateClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  riskTier: z.enum(["conservative", "moderate", "aggressive"]).optional(),
  mt5AccountId: z.string().optional(),
  polyWallet: z.string().optional(),
});

// ── GET / ────────────────────────────────────────────────

clientsRouter.get("/", async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

// ── GET /:id ─────────────────────────────────────────────

clientsRouter.get("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (clientErr) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  // Fetch latest dash_metrics for this client
  const { data: metrics } = await supabase
    .from("dash_metrics")
    .select("*")
    .eq("client_id", id)
    .order("recorded_at", { ascending: false })
    .limit(20);

  res.json({ ...client, metrics: metrics ?? [] });
});

// ── POST / ───────────────────────────────────────────────

clientsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = CreateClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, email, riskTier, mt5AccountId, polyWallet } = parsed.data;

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name,
      email,
      risk_tier: riskTier ?? "moderate",
      mt5_account_id: mt5AccountId ?? null,
      poly_wallet: polyWallet ?? null,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json(client);
});

// ── PATCH /:id/trading ───────────────────────────────────
// Toggle trading features for a specific client (admin only)

clientsRouter.patch("/:id/trading", async (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled: boolean };
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled (boolean) required" }); return;
  }

  const { data, error } = await supabase
    .from("clients")
    .update({ trading_enabled: enabled })
    .eq("id", req.params.id)
    .select("id, name, trading_enabled")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});
