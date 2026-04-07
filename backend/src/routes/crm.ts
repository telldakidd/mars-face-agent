import { Router, type Request, type Response } from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { supabase } from "../lib/supabase.js";

export const crmRouter = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

// ── Types ────────────────────────────────────────────────────────────────────

type Stage = "new" | "contacted" | "proposal" | "negotiating" | "won" | "lost";

interface Lead {
  id: string;
  clientId: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  stage: Stage;
  value: number;
  notes: string;
  createdAt: string;
  lastContactAt: string;
}

// ── In-memory fallback ───────────────────────────────────────────────────────

const memStore = new Map<string, Lead[]>();
function memGet(clientId: string): Lead[] {
  if (!memStore.has(clientId)) memStore.set(clientId, []);
  return memStore.get(clientId)!;
}

// ── Supabase helpers (snake_case ↔ camelCase) ─────────────────────────────────

function toLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    name: row.name as string,
    company: (row.company as string) ?? "",
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
    stage: (row.stage as Stage) ?? "new",
    value: (row.value as number) ?? 0,
    notes: (row.notes as string) ?? "",
    createdAt: row.created_at as string,
    lastContactAt: (row.last_contact_at as string) ?? row.created_at as string,
  };
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreateLeadSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1),
  company: z.string().optional().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  stage: z.enum(["new", "contacted", "proposal", "negotiating", "won", "lost"]).optional().default("new"),
  value: z.number().optional().default(0),
  notes: z.string().optional().default(""),
});

const UpdateLeadSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  stage: z.enum(["new", "contacted", "proposal", "negotiating", "won", "lost"]).optional(),
  value: z.number().optional(),
  notes: z.string().optional(),
});

const DeleteLeadSchema = z.object({ clientId: z.string().min(1) });
const FollowupSchema = z.object({ clientId: z.string().min(1) });

// ── GET /:clientId ────────────────────────────────────────────────────────────

crmRouter.get("/:clientId", async (req: Request, res: Response) => {
  const { clientId } = req.params;
  try {
    const { data, error } = await supabase
      .from("crm_leads")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json((data ?? []).map(toLead));
  } catch {
    res.json(memGet(clientId));
  }
});

// ── POST / ────────────────────────────────────────────────────────────────────

crmRouter.post("/", async (req: Request, res: Response) => {
  const parsed = CreateLeadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { clientId, name, company, email, phone, stage, value, notes } = parsed.data;
  const now = new Date().toISOString();
  const id = randomUUID();

  try {
    const { data, error } = await supabase.from("crm_leads").insert({
      id, client_id: clientId, name, company, email, phone, stage, value, notes,
      created_at: now, last_contact_at: now,
    }).select().single();
    if (error) throw error;
    res.status(201).json(toLead(data));
  } catch {
    const lead: Lead = { id, clientId, name, company, email, phone, stage, value, notes, createdAt: now, lastContactAt: now };
    memGet(clientId).push(lead);
    res.status(201).json(lead);
  }
});

// ── PUT /:id ──────────────────────────────────────────────────────────────────

crmRouter.put("/:id", async (req: Request, res: Response) => {
  const parsed = UpdateLeadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { id } = req.params;
  const { clientId, ...updates } = parsed.data;
  const now = new Date().toISOString();

  try {
    const patch: Record<string, unknown> = { last_contact_at: now };
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.company !== undefined) patch.company = updates.company;
    if (updates.email !== undefined) patch.email = updates.email;
    if (updates.phone !== undefined) patch.phone = updates.phone;
    if (updates.stage !== undefined) patch.stage = updates.stage;
    if (updates.value !== undefined) patch.value = updates.value;
    if (updates.notes !== undefined) patch.notes = updates.notes;

    const { data, error } = await supabase.from("crm_leads").update(patch).eq("id", id).eq("client_id", clientId).select().single();
    if (error) throw error;
    res.json(toLead(data));
  } catch {
    const leads = memGet(clientId);
    const idx = leads.findIndex((l) => l.id === id);
    if (idx === -1) { res.status(404).json({ error: "Lead not found" }); return; }
    leads[idx] = { ...leads[idx], ...updates, lastContactAt: now } as Lead;
    res.json(leads[idx]);
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────

crmRouter.delete("/:id", async (req: Request, res: Response) => {
  const parsed = DeleteLeadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { id } = req.params;
  const { clientId } = parsed.data;

  try {
    const { error } = await supabase.from("crm_leads").delete().eq("id", id).eq("client_id", clientId);
    if (error) throw error;
    res.json({ success: true });
  } catch {
    const leads = memGet(clientId);
    const idx = leads.findIndex((l) => l.id === id);
    if (idx !== -1) leads.splice(idx, 1);
    res.json({ success: true });
  }
});

// ── POST /:id/followup ────────────────────────────────────────────────────────

crmRouter.post("/:id/followup", async (req: Request, res: Response) => {
  const parsed = FollowupSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { id } = req.params;
  const { clientId } = parsed.data;

  let lead: Lead | undefined;
  try {
    const { data } = await supabase.from("crm_leads").select("*").eq("id", id).eq("client_id", clientId).single();
    if (data) lead = toLead(data);
  } catch { /**/ }
  if (!lead) lead = memGet(clientId).find((l) => l.id === id);
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 300,
      system: "You are a professional sales copywriter. Write concise, warm, and persuasive follow-up messages. Do not use placeholders — write the full message ready to send.",
      messages: [{
        role: "user",
        content: `Write a professional follow-up message (~80 words) for this sales lead:\n- Name: ${lead.name}\n- Company: ${lead.company || "their company"}\n- Stage: ${lead.stage}\n- Notes: ${lead.notes || "none"}\n\nMove the deal forward based on the stage. Return only the message text.`,
      }],
    });
    const message = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
