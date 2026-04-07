import { Router, type Request, type Response } from "express";
import { execFile } from "child_process";
import { readdir, readFile } from "fs/promises";
import path from "path";

export const weatherbotRouter = Router();

const WEATHERBOT_DIR = process.env.WEATHERBOT_DIR ?? "C:/WORKFLOW FACELESS YOUTUBE";
const WEATHERBOT_LOGS = path.join(WEATHERBOT_DIR, "logs");

// GET /api/weatherbot/status — latest signals
weatherbotRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const files = await readdir(WEATHERBOT_LOGS);
    const signalFiles = files
      .filter((f) => f.startsWith("weather_signals_"))
      .sort()
      .reverse();

    if (signalFiles.length === 0) {
      res.json({ status: "no_signals", signals: [] });
      return;
    }

    const latest = path.join(WEATHERBOT_LOGS, signalFiles[0]);
    const raw = await readFile(latest, "utf-8");
    const signals = JSON.parse(raw);
    res.json({ status: "active", file: signalFiles[0], signals });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/weatherbot/run — trigger one cycle
weatherbotRouter.post("/run", (req: Request, res: Response) => {
  const city = (req.body as Record<string, string>).city ?? undefined;
  const args = ["weatherbot.py", "--once"];
  if (city) args.push("--city", city);

  execFile("python", args, { cwd: WEATHERBOT_DIR, timeout: 120_000 }, (err, stdout, stderr) => {
    if (err) {
      res.status(500).json({ error: err.message, stderr });
      return;
    }
    res.json({ ok: true, output: stdout.slice(-2000) });
  });
});

// GET /api/weatherbot/backtest/:days — quick backtest
weatherbotRouter.get("/backtest/:days", (req: Request, res: Response) => {
  const days = parseInt(req.params.days, 10) || 30;
  execFile(
    "python",
    ["weatherbot.py", "--backtest", String(days), "--bankroll", "900", "--shared"],
    { cwd: WEATHERBOT_DIR, timeout: 600_000 },
    (err, stdout) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      res.json({ ok: true, days, summary: stdout.slice(-3000) });
    }
  );
});
