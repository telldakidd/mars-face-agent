import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { supabase } from "../lib/supabase.js";

export const expensesRouter = Router();

type Category = "food" | "travel" | "software" | "marketing" | "equipment" | "other";

interface Expense {
  id: string; clientId: string; amount: number; category: Category;
  description: string; date: string; createdAt: string;
}

// ── In-memory fallback ────────────────────────────────────────────────────────

const memStore = new Map<string, Expense[]>();
function memGet(clientId: string): Expense[] {
  if (!memStore.has(clientId)) memStore.set(clientId, []);
  return memStore.get(clientId)!;
}

function toExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string, clientId: row.client_id as string,
    amount: row.amount as number, category: (row.category as Category) ?? "other",
    description: (row.description as string) ?? "", date: row.date as string,
    createdAt: row.created_at as string,
  };
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  clientId: z.string().min(1), amount: z.number().positive(),
  category: z.enum(["food", "travel", "software", "marketing", "equipment", "other"]),
  description: z.string().optional().default(""), date: z.string().optional(),
});
const DeleteSchema = z.object({ clientId: z.string().min(1) });

// ── GET /:clientId ────────────────────────────────────────────────────────────

expensesRouter.get("/:clientId", async (req: Request, res: Response) => {
  const { clientId } = req.params;
  try {
    const { data, error } = await supabase.from("expenses").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    if (error) throw error;
    res.json((data ?? []).map(toExpense));
  } catch {
    res.json([...memGet(clientId)].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }
});

// ── GET /:clientId/summary ────────────────────────────────────────────────────

expensesRouter.get("/:clientId/summary", async (req: Request, res: Response) => {
  const { clientId } = req.params;
  const now = new Date();
  const month = now.getMonth(), year = now.getFullYear();

  let all: Expense[] = [];
  try {
    const { data, error } = await supabase.from("expenses").select("*").eq("client_id", clientId);
    if (error) throw error;
    all = (data ?? []).map(toExpense);
  } catch {
    all = memGet(clientId);
  }

  const thisMonth = all.filter((e) => { const d = new Date(e.date); return d.getMonth() === month && d.getFullYear() === year; });
  const total = thisMonth.reduce((s, e) => s + e.amount, 0);
  const byCategory: Record<string, number> = {};
  for (const e of thisMonth) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  res.json({ total, count: thisMonth.length, byCategory, month: `${year}-${String(month + 1).padStart(2, "0")}` });
});

// ── POST / ────────────────────────────────────────────────────────────────────

expensesRouter.post("/", async (req: Request, res: Response) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { clientId, amount, category, description, date } = parsed.data;
  const now = new Date().toISOString();
  const id = randomUUID();
  const dateVal = date ?? now.split("T")[0];

  try {
    const { data, error } = await supabase.from("expenses").insert({ id, client_id: clientId, amount, category, description, date: dateVal, created_at: now }).select().single();
    if (error) throw error;
    res.status(201).json(toExpense(data));
  } catch {
    const expense: Expense = { id, clientId, amount, category, description, date: dateVal, createdAt: now };
    memGet(clientId).push(expense);
    res.status(201).json(expense);
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────

expensesRouter.delete("/:id", async (req: Request, res: Response) => {
  const parsed = DeleteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { id } = req.params; const { clientId } = parsed.data;
  try {
    const { error } = await supabase.from("expenses").delete().eq("id", id).eq("client_id", clientId);
    if (error) throw error;
    res.json({ success: true });
  } catch {
    const list = memGet(clientId);
    const idx = list.findIndex((e) => e.id === id);
    if (idx !== -1) list.splice(idx, 1);
    res.json({ success: true });
  }
});
