import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { broadcastToClient } from "../websocket.js";

export const phoneRouter = Router();

const CommandSchema = z.object({
  clientId: z.string().uuid(),
  command: z.enum([
    "set_brightness",
    "set_volume",
    "set_wifi",
    "open_app",
    "lock_screen",
    "set_do_not_disturb",
    "take_screenshot",
    "set_flashlight",
    "set_bluetooth",
    "set_airplane_mode",
    "send_sms",
    "make_call",
    "set_alarm",
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.unknown())]).optional(),
});

phoneRouter.post("/command", async (req: Request, res: Response) => {
  const parsed = CommandSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { clientId, command, value } = parsed.data;

  broadcastToClient(clientId, {
    type: "phone_command",
    command,
    value: value ?? null,
    timestamp: new Date().toISOString(),
  });

  res.json({ ok: true, command, value, sent_to: clientId.slice(0, 8) });
});

// Broadcast a message or command to ALL connected devices
phoneRouter.post("/broadcast", async (req: Request, res: Response) => {
  const { command, value, message, type: msgType } = req.body as {
    command?: string;
    value?: unknown;
    message?: string;
    type?: string;
  };

  const { broadcastAll } = await import("../websocket.js");

  if (message) {
    // Text broadcast — show as notification + TTS on all devices
    broadcastAll({ type: msgType ?? "alert", message, value: value ?? null });
    res.json({ ok: true, sent: 30, message });
  } else if (command) {
    broadcastAll({ type: "phone_command", command, value: value ?? null });
    res.json({ ok: true, command, broadcast: true });
  } else {
    res.status(400).json({ error: "command or message required" });
  }
});
