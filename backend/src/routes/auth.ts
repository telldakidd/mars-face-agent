import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

export const authRouter = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/auth/device-register
// Creates a user + client record for a device ID, returns a JWT
authRouter.post("/device-register", async (req, res) => {
  const { deviceId, deviceName } = req.body as { deviceId: string; deviceName?: string };
  if (!deviceId) return res.status(400).json({ error: "deviceId required" });

  const email    = `${deviceId}@mars.local`;
  const password = `mars_${deviceId}_secure`;

  try {
    // Try to sign in first (device already registered)
    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

    if (signIn?.session) {
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, trading_enabled, subscription_tier")
        .eq("id", signIn.user!.id)
        .single();

      return res.json({
        token:    signIn.session.access_token,
        clientId: signIn.user!.id,
        name:     client?.name ?? deviceName ?? "User",
        tradingEnabled: client?.trading_enabled ?? false,
      });
    }

    // New device — create user
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) throw createErr ?? new Error("create failed");

    // Create client record
    await supabase.from("clients").insert({
      id:                created.user.id,
      name:              deviceName ?? "User",
      email,
      subscription_tier: "basic",
      trading_enabled:   false,
    });

    // Sign in to get JWT
    const { data: session } = await supabase.auth.signInWithPassword({ email, password });

    return res.json({
      token:    session!.session!.access_token,
      clientId: created.user.id,
      name:     deviceName ?? "User",
      tradingEnabled: false,
    });
  } catch (err: any) {
    console.error("[auth] device-register error:", err);
    res.status(500).json({ error: err.message ?? "Registration failed" });
  }
});
