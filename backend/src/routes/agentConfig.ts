import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

export const agentConfigRouter = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const DEFAULT_CONFIG = {
  agent_name: "Mars",
  personality: "You are Mars, a professional AI assistant. You are sharp, concise, and highly capable.",
  communication_style: "professional",   // professional | casual | friendly | formal
  focus_areas: [] as string[],           // e.g. ["trading", "real estate", "content creation"]
  custom_instructions: "",              // free-form additions the client gave via self-configure
  elevenlabs_voice_id: "TxGEqnHWrfWFTfGW9XjX",
  tavus_replica_id: process.env.TAVUS_REPLICA_ID ?? "",
  tools_enabled: ["phone_command", "send_sms", "make_call", "set_alarm", "web_search"],
  avatar_language: "en",
  avatar_greeting: "",
  session_duration_mins: 30,
};

// GET /api/agent-config/:clientId
agentConfigRouter.get("/:clientId", async (req, res) => {
  const { clientId } = req.params;
  const { data } = await supabase
    .from("agent_config")
    .select("*")
    .eq("client_id", clientId)
    .single();

  res.json(data ?? { ...DEFAULT_CONFIG, client_id: clientId });
});

// PUT /api/agent-config/:clientId  (full save from settings screen)
agentConfigRouter.put("/:clientId", async (req, res) => {
  const { clientId } = req.params;
  const {
    agent_name, personality, communication_style, focus_areas,
    custom_instructions, elevenlabs_voice_id, tavus_replica_id, tools_enabled,
    avatar_language, avatar_greeting, session_duration_mins,
  } = req.body;

  const { data, error } = await supabase
    .from("agent_config")
    .upsert({
      client_id:              clientId,
      agent_name:             agent_name              ?? DEFAULT_CONFIG.agent_name,
      personality:            personality             ?? DEFAULT_CONFIG.personality,
      communication_style:    communication_style     ?? DEFAULT_CONFIG.communication_style,
      focus_areas:            focus_areas             ?? DEFAULT_CONFIG.focus_areas,
      custom_instructions:    custom_instructions     ?? DEFAULT_CONFIG.custom_instructions,
      elevenlabs_voice_id:    elevenlabs_voice_id     ?? DEFAULT_CONFIG.elevenlabs_voice_id,
      tavus_replica_id:       tavus_replica_id        ?? DEFAULT_CONFIG.tavus_replica_id,
      tools_enabled:          tools_enabled           ?? DEFAULT_CONFIG.tools_enabled,
      avatar_language:        avatar_language         ?? DEFAULT_CONFIG.avatar_language,
      avatar_greeting:        avatar_greeting         ?? DEFAULT_CONFIG.avatar_greeting,
      session_duration_mins:  session_duration_mins   ?? DEFAULT_CONFIG.session_duration_mins,
      updated_at:             new Date().toISOString(),
    }, { onConflict: "client_id" })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/agent-config/:clientId  (partial update — used by self-configure meta-agent)
agentConfigRouter.patch("/:clientId", async (req, res) => {
  const { clientId } = req.params;

  // Fetch current config first
  const { data: current } = await supabase
    .from("agent_config")
    .select("*")
    .eq("client_id", clientId)
    .single();

  const base = current ?? { ...DEFAULT_CONFIG, client_id: clientId };

  const patch: Record<string, unknown> = { client_id: clientId, updated_at: new Date().toISOString() };
  const allowed = [
    "agent_name", "personality", "communication_style",
    "focus_areas", "custom_instructions", "elevenlabs_voice_id",
    "tavus_replica_id", "tools_enabled",
    "avatar_language", "avatar_greeting", "session_duration_mins",
  ];
  for (const key of allowed) {
    patch[key] = req.body[key] !== undefined ? req.body[key] : base[key as keyof typeof base];
  }

  const { data, error } = await supabase
    .from("agent_config")
    .upsert(patch, { onConflict: "client_id" })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
