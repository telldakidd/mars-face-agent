import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { MT5Connector } from "../connectors/mt5.js";
import { broadcastToClient } from "../websocket.js";

export const basketbotRouter = Router();
const mt5 = new MT5Connector();

const ControlSchema = z.object({
  clientId: z.string().uuid(),
  action: z.enum(["start", "stop", "set"]),
  symbol: z.string().optional(),
  param: z.string().optional(),
  value: z.unknown().optional(),
});

basketbotRouter.post("/control", async (req: Request, res: Response) => {
  const parsed = ControlSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { clientId, action, symbol, param, value } = parsed.data;

  await mt5.connect();

  try {
    let result: string;
    switch (action) {
      case "start":
        await mt5.startBasketBot(symbol ?? "XAUUSD");
        result = `BasketBot started on ${symbol ?? "XAUUSD"}`;
        break;
      case "stop":
        await mt5.stopBasketBot();
        result = "BasketBot stopped";
        break;
      case "set":
        if (!param) { res.status(400).json({ error: "param required for set action" }); return; }
        await mt5.setParam(param, value);
        result = `${param} set to ${value}`;
        break;
    }

    // Push status update to device
    broadcastToClient(clientId, {
      type: "bot_status",
      bot: "BasketBot",
      action,
      result,
      timestamp: new Date().toISOString(),
    });

    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/basketbot/status — account + BasketBot + M4RSBot state
basketbotRouter.get("/status", async (_req: Request, res: Response) => {
  await mt5.connect();
  const [info, positions] = await Promise.all([
    mt5.getAccountInfo(),
    mt5.getPositions(),
  ]);
  const basketPositions = positions.filter((p) => p.magic === 20251222);
  const m4rsPositions   = positions.filter((p) => p.magic === 20251204);
  res.json({
    account: info,
    basketbot: {
      running: basketPositions.length > 0,
      positions: basketPositions,
      totalProfit: basketPositions.reduce((s, p) => s + p.profit, 0),
    },
    m4rsbot: {
      running: m4rsPositions.length > 0,
      positions: m4rsPositions,
      totalProfit: m4rsPositions.reduce((s, p) => s + p.profit, 0),
    },
  });
});

// POST /api/basketbot/m4rs-control — set M4RSBot parameters
basketbotRouter.post("/m4rs-control", async (req: Request, res: Response) => {
  const { action, param, value } = req.body as { action: string; param?: string; value?: unknown };
  await mt5.connect();
  try {
    if (action === "set" && param) {
      await mt5.setParam(param, value);
      res.json({ ok: true, result: `${param} set to ${value}` });
    } else {
      res.status(400).json({ error: "action=set and param are required" });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
