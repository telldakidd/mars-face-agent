import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { broadcastToClient } from "../websocket.js";

export const workflowsRouter = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreateWorkflowSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  platform: z.enum(["make", "n8n"]),
  workflowJson: z.record(z.unknown()).optional(),
  guideTitle: z.string().optional(),
  guideSteps: z
    .array(z.object({ step: z.number(), text: z.string(), imageUrl: z.string().optional() }))
    .default([]),
  tags: z.array(z.string()).default([]),
  version: z.string().default("1.0"),
});

const UpdateWorkflowSchema = CreateWorkflowSchema.partial();

const AssignWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
  clientIds: z.array(z.string().uuid()).min(1),
  notes: z.string().optional(),
});

// ── CRUD: Workflows ──────────────────────────────────────────────────────────

// GET /api/workflows — list all workflows (optionally filter by platform)
workflowsRouter.get("/", async (req: Request, res: Response) => {
  const platform = req.query.platform as string | undefined;

  let query = supabase
    .from("workflows")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (platform && (platform === "make" || platform === "n8n")) {
    query = query.eq("platform", platform);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

// GET /api/workflows/:id — single workflow with guide
workflowsRouter.get("/:id", async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error || !data) { res.status(404).json({ error: "Workflow not found" }); return; }
  res.json(data);
});

// POST /api/workflows — create a new workflow (admin)
workflowsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = CreateWorkflowSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const d = parsed.data;
  const { data, error } = await supabase
    .from("workflows")
    .insert({
      title: d.title,
      description: d.description,
      platform: d.platform,
      workflow_json: d.workflowJson ?? null,
      guide_title: d.guideTitle,
      guide_steps: d.guideSteps,
      tags: d.tags,
      version: d.version,
      created_by: (req as any).clientId ?? null,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

// PATCH /api/workflows/:id — update workflow (admin)
workflowsRouter.patch("/:id", async (req: Request, res: Response) => {
  const parsed = UpdateWorkflowSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.title !== undefined) updates.title = d.title;
  if (d.description !== undefined) updates.description = d.description;
  if (d.platform !== undefined) updates.platform = d.platform;
  if (d.workflowJson !== undefined) updates.workflow_json = d.workflowJson;
  if (d.guideTitle !== undefined) updates.guide_title = d.guideTitle;
  if (d.guideSteps !== undefined) updates.guide_steps = d.guideSteps;
  if (d.tags !== undefined) updates.tags = d.tags;
  if (d.version !== undefined) updates.version = d.version;

  const { data, error } = await supabase
    .from("workflows")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

// DELETE /api/workflows/:id — soft-delete (admin)
workflowsRouter.delete("/:id", async (req: Request, res: Response) => {
  const { error } = await supabase
    .from("workflows")
    .update({ is_active: false })
    .eq("id", req.params.id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ── Assignment: Push workflows to customer phones ────────────────────────────

// POST /api/workflows/assign — send workflow(s) to customer(s)
workflowsRouter.post("/assign", async (req: Request, res: Response) => {
  const parsed = AssignWorkflowSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { workflowId, clientIds, notes } = parsed.data;

  // Get workflow details for the push notification
  const { data: workflow } = await supabase
    .from("workflows")
    .select("id, title, platform")
    .eq("id", workflowId)
    .single();

  if (!workflow) { res.status(404).json({ error: "Workflow not found" }); return; }

  // Create assignment rows
  const rows = clientIds.map((clientId) => ({
    workflow_id: workflowId,
    client_id: clientId,
    status: "sent",
    notes: notes ?? null,
  }));

  const { data, error } = await supabase
    .from("workflow_assignments")
    .upsert(rows, { onConflict: "workflow_id,client_id" })
    .select();

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Push notification to each client via WebSocket
  for (const clientId of clientIds) {
    broadcastToClient(clientId, {
      type: "workflow_assigned",
      workflowId: workflow.id,
      title: workflow.title,
      platform: workflow.platform,
      message: `New ${workflow.platform.toUpperCase()} workflow: ${workflow.title}`,
    });
  }

  res.json({ ok: true, assigned: data?.length ?? 0 });
});

// GET /api/workflows/assigned/:clientId — workflows assigned to a client
workflowsRouter.get("/assigned/:clientId", async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from("workflow_assignments")
    .select(`
      id,
      status,
      sent_at,
      viewed_at,
      completed_at,
      notes,
      workflows (
        id,
        title,
        description,
        platform,
        guide_title,
        guide_steps,
        tags,
        version,
        workflow_json
      )
    `)
    .eq("client_id", req.params.clientId)
    .order("sent_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

// PATCH /api/workflows/assignment/:id/status — update assignment status
workflowsRouter.patch("/assignment/:id/status", async (req: Request, res: Response) => {
  const { status } = req.body as { status: string };
  const validStatuses = ["pending", "sent", "viewed", "setup_complete", "error"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  const updates: Record<string, unknown> = { status };
  if (status === "viewed") updates.viewed_at = new Date().toISOString();
  if (status === "setup_complete") updates.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("workflow_assignments")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

// ── Admin: All devices + assignment overview ─────────────────────────────────

// GET /api/workflows/admin/devices — all devices with workflow assignment counts
workflowsRouter.get("/admin/devices", async (_req: Request, res: Response) => {
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, subscription_tier, is_admin, created_at");

  const { data: devices } = await supabase
    .from("device_registry")
    .select("client_id, device_id, app_version, last_seen, is_active");

  const { data: assignments } = await supabase
    .from("workflow_assignments")
    .select("client_id, status");

  // Build assignment stats per client
  const statsMap = new Map<string, { total: number; pending: number; complete: number }>();
  for (const a of assignments ?? []) {
    if (!statsMap.has(a.client_id)) statsMap.set(a.client_id, { total: 0, pending: 0, complete: 0 });
    const s = statsMap.get(a.client_id)!;
    s.total++;
    if (a.status === "pending" || a.status === "sent") s.pending++;
    if (a.status === "setup_complete") s.complete++;
  }

  const deviceMap = new Map((devices ?? []).map((d) => [d.client_id, d]));

  const result = (clients ?? [])
    .filter((c) => !c.is_admin)
    .map((c) => ({
      ...c,
      device: deviceMap.get(c.id) ?? null,
      workflowStats: statsMap.get(c.id) ?? { total: 0, pending: 0, complete: 0 },
    }));

  res.json(result);
});
