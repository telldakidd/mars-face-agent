import { Router, type Request, type Response } from "express";
import { generateMorningBriefing, runDailyBriefings } from "../services/morning-briefing.js";
import { supabase } from "../lib/supabase.js";

export const briefingRouter = Router();

// GET /api/agent/briefing/:clientId
briefingRouter.get("/:clientId", async (req: Request, res: Response) => {
  const { clientId } = req.params;
  try {
    const briefing = await generateMorningBriefing(clientId);
    res.json(briefing);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/agent/briefing/all — trigger all client briefings (cron job calls this)
briefingRouter.post("/all", async (_req: Request, res: Response) => {
  try {
    await runDailyBriefings();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
