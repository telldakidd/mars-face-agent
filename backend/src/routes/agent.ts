import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { chat } from "../services/claude-agent.js";
import { getNewsSentiment } from "../services/news-sentiment.js";
import { writeTradeJournal } from "../services/trade-journal.js";

export const agentRouter = Router();

// ── Schemas ──────────────────────────────────────────────

const LogBodySchema = z.object({
  clientId: z.string().uuid(),
  actionType: z.string().min(1),
  description: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const EscalateBodySchema = z.object({
  clientId: z.string().uuid(),
  taskType: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  description: z.string().optional(),
});

// ── POST /log ────────────────────────────────────────────

agentRouter.post("/log", async (req: Request, res: Response) => {
  const parsed = LogBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { clientId, actionType, description, confidence, metadata } =
    parsed.data;

  const { data: activity, error: actErr } = await supabase
    .from("agent_activity")
    .insert({
      client_id: clientId,
      action_type: actionType,
      description,
      confidence,
      metadata: metadata ?? {},
    })
    .select()
    .single();

  if (actErr) {
    res.status(500).json({ error: actErr.message });
    return;
  }

  // Also write to audit_log
  await supabase.from("audit_log").insert({
    client_id: clientId,
    event_type: "agent_log",
    detail: { action_type: actionType, activity_id: activity.id },
    ip_address: req.ip,
  });

  res.status(201).json(activity);
});

// ── POST /escalate ───────────────────────────────────────

agentRouter.post("/escalate", async (req: Request, res: Response) => {
  const parsed = EscalateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { clientId, taskType, payload, description } = parsed.data;

  // Insert high-priority task (priority 1)
  const { data: task, error: taskErr } = await supabase
    .from("task_queue")
    .insert({
      client_id: clientId,
      task_type: taskType,
      payload: payload ?? {},
      priority: 1,
      status: "pending",
    })
    .select()
    .single();

  if (taskErr) {
    res.status(500).json({ error: taskErr.message });
    return;
  }

  // Audit log
  await supabase.from("audit_log").insert({
    client_id: clientId,
    event_type: "agent_escalate",
    detail: { task_id: task.id, task_type: taskType, description },
    ip_address: req.ip,
  });

  res.status(201).json(task);
});

// ── POST /chat ───────────────────────────────────────────

const ChatBodySchema = z.object({
  clientId: z.string().uuid(),
  message: z.string().min(1),
  imageBase64: z.string().optional(),
  imageMediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).optional(),
});

agentRouter.post("/chat", async (req: Request, res: Response) => {
  const parsed = ChatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { clientId, message, imageBase64, imageMediaType } = parsed.data;

  try {
    const result = await chat(clientId, message, imageBase64, imageMediaType);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /news/:symbol ────────────────────────────────────

agentRouter.get("/news/:symbol", async (req: Request, res: Response) => {
  const { symbol } = req.params;
  try {
    const results = await getNewsSentiment(symbol.toUpperCase());
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /journal/:tradeId ────────────────────────────────

const JournalBodySchema = z.object({ clientId: z.string().uuid() });

agentRouter.post("/journal/:tradeId", async (req: Request, res: Response) => {
  const parsed = JournalBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { tradeId } = req.params;
  const { clientId } = parsed.data;
  try {
    const journal = await writeTradeJournal(clientId, tradeId);
    res.json({ journal });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /activity/:clientId ──────────────────────────────

agentRouter.get(
  "/activity/:clientId",
  async (req: Request, res: Response) => {
    const clientId = req.params.clientId;

    const { data, error } = await supabase
      .from("agent_activity")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  }
);

// ── GET /memory/:clientId ────────────────────────────────
// Returns structured memory: client profile + saved memories + recent activity

agentRouter.get("/memory/:clientId", async (req: Request, res: Response) => {
  const { clientId } = req.params;

  const [clientRes, memoriesRes, activityRes] = await Promise.all([
    supabase
      .from("clients")
      .select("name, risk_tier, subscription_tier, voice_to_voice_enabled")
      .eq("id", clientId)
      .single(),
    supabase
      .from("agent_activity")
      .select("id, action_type, description, created_at")
      .eq("client_id", clientId)
      .like("action_type", "memory_%")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("agent_activity")
      .select("id, action_type, description, created_at")
      .eq("client_id", clientId)
      .not("action_type", "like", "memory_%")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (clientRes.error) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  res.json({
    profile: {
      name: clientRes.data.name,
      riskTier: clientRes.data.risk_tier,
      subscriptionTier: clientRes.data.subscription_tier,
      voiceToVoice: clientRes.data.voice_to_voice_enabled,
    },
    memories: (memoriesRes.data ?? []).map((m) => ({
      id: m.id,
      category: (m.action_type as string).replace("memory_", ""),
      text: m.description,
      createdAt: m.created_at,
    })),
    recentActivity: (activityRes.data ?? []).map((a) => ({
      id: a.id,
      actionType: a.action_type,
      description: a.description,
      createdAt: a.created_at,
    })),
  });
});

// ── DELETE /memory/:activityId ───────────────────────────

agentRouter.delete("/memory/:activityId", async (req: Request, res: Response) => {
  const { activityId } = req.params;

  const { error } = await supabase
    .from("agent_activity")
    .delete()
    .eq("id", activityId)
    .like("action_type", "memory_%"); // safety: only delete memory entries

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// ── POST /memory/:clientId ───────────────────────────────

const MemoryBodySchema = z.object({
  text: z.string().min(1),
  category: z.enum(["preference", "risk", "trade_insight"]),
});

agentRouter.post("/memory/:clientId", async (req: Request, res: Response) => {
  const parsed = MemoryBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { clientId } = req.params;
  const { text, category } = parsed.data;

  const { data, error } = await supabase
    .from("agent_activity")
    .insert({
      client_id: clientId,
      action_type: `memory_${category}`,
      description: text,
      confidence: 1.0,
      metadata: { category, manually_added: true },
    })
    .select("id, action_type, description, created_at")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json({
    id: data.id,
    category,
    text: data.description,
    createdAt: data.created_at,
  });
});
