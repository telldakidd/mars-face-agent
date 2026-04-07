import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { supabase } from "../lib/supabase.js";

export const provisioningRouter = Router();

// POST /api/provision/generate — admin creates a provisioning QR for a new client
const GenerateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subscriptionTier: z.enum(["basic", "pro", "elite"]).default("basic"),
  voiceToVoice: z.boolean().default(false),
  tradingEnabled: z.boolean().default(false),
  serverUrl: z.string().url().optional(),
});

provisioningRouter.post("/generate", async (req: Request, res: Response) => {
  const parsed = GenerateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { name, email, subscriptionTier, voiceToVoice, tradingEnabled, serverUrl } = parsed.data;

  // Create Supabase auth user
  const tempPassword = randomBytes(12).toString("base64url");
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (authErr) { res.status(500).json({ error: authErr.message }); return; }

  // Create client record
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .insert({
      id: authData.user.id,
      name,
      email,
      subscription_tier: subscriptionTier,
      voice_to_voice_enabled: voiceToVoice,
      trading_enabled: tradingEnabled,
    })
    .select()
    .single();

  if (clientErr) { res.status(500).json({ error: clientErr.message }); return; }

  // QR payload: scan to auto-login
  const qrPayload = {
    version: 1,
    clientId: client.id,
    email,
    password: tempPassword,
    serverUrl: serverUrl ?? process.env.SERVER_URL ?? "https://your-server.com",
    name,
    tier: subscriptionTier,
    voiceToVoice,
  };

  // Return base64-encoded payload (app decodes on scan)
  const encoded = Buffer.from(JSON.stringify(qrPayload)).toString("base64");
  const qrData = `marsagent://provision?data=${encoded}`;

  res.json({
    clientId: client.id,
    qrData,   // feed this to qrcode.react in the admin dashboard
    qrPayload: { ...qrPayload, password: "***" }, // safe display
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  });
});

// GET /api/provision/fleet — list all clients + device status
provisioningRouter.get("/fleet", async (_req: Request, res: Response) => {
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, risk_tier, subscription_tier, voice_to_voice_enabled, created_at");

  const { data: devices } = await supabase
    .from("device_registry")
    .select("client_id, device_id, app_version, last_seen, is_active");

  const deviceMap = new Map((devices ?? []).map(d => [d.client_id, d]));

  const fleet = (clients ?? []).map(c => ({
    ...c,
    device: deviceMap.get(c.id) ?? null,
    online: false, // WebSocket status injected server-side
  }));

  res.json(fleet);
});

// POST /api/provision/device — device registers itself after QR scan
const DeviceSchema = z.object({
  clientId: z.string().uuid(),
  deviceId: z.string(),
  appVersion: z.string().optional(),
});

provisioningRouter.post("/device", async (req: Request, res: Response) => {
  const parsed = DeviceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { clientId, deviceId, appVersion } = parsed.data;
  await supabase.from("device_registry").upsert({
    client_id: clientId,
    device_id: deviceId,
    app_version: appVersion,
    last_seen: new Date().toISOString(),
    is_active: true,
  }, { onConflict: "device_id" });

  res.json({ ok: true });
});

// POST /api/provision/wipe — remote device wipe (admin only)
provisioningRouter.post("/wipe", async (req: Request, res: Response) => {
  const { clientId } = req.body as { clientId: string };
  if (!clientId) { res.status(400).json({ error: "clientId required" }); return; }

  // Mark device inactive
  await supabase.from("device_registry").update({ is_active: false }).eq("client_id", clientId);

  // Push wipe command to device via WebSocket
  const { broadcastToClient } = await import("../websocket.js");
  broadcastToClient(clientId, { type: "remote_wipe", timestamp: new Date().toISOString() });

  res.json({ ok: true, message: "Wipe command sent" });
});
