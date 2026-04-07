import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_CONFIG } from "./agentConfig.js";

export const agentSetupRouter = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase  = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// ── Tool definition ───────────────────────────────────────────────────────────

const UPDATE_CONFIG_TOOL: Anthropic.Tool = {
  name: "update_agent_config",
  description:
    "Apply one or more customization changes to this client's Mars AI agent. " +
    "Call this whenever the client requests a change. You may pass only the fields that need updating.",
  input_schema: {
    type: "object" as const,
    properties: {
      agent_name: {
        type: "string",
        description: "The name the agent should use for itself (e.g. 'Alex', 'Mars', 'Aria').",
      },
      personality: {
        type: "string",
        description:
          "A concise system-level personality description used in every conversation. " +
          "Include the agent name, tone, and any specialization (e.g. 'You are Alex, a sharp real-estate-focused AI...').",
      },
      communication_style: {
        type: "string",
        enum: ["professional", "casual", "friendly", "formal"],
        description: "Overall tone for responses.",
      },
      focus_areas: {
        type: "array",
        items: { type: "string" },
        description:
          "Topics the agent should prioritize, e.g. ['trading', 'real estate', 'content creation', 'fitness'].",
      },
      custom_instructions: {
        type: "string",
        description:
          "Additional free-form instructions appended to every system prompt, e.g. " +
          "'Always end responses with an actionable tip.' or 'User runs a logistics company.'",
      },
      tools_enabled: {
        type: "array",
        items: { type: "string" },
        description:
          "List of tool IDs the agent may use. Available: phone_command, send_sms, make_call, set_alarm, web_search, get_portfolio, control_bot.",
      },
    },
  },
};

// ── Conversation history (in-memory per client, resets on server restart) ─────
// For production you'd persist in DB; for now in-memory is fine.
const histories = new Map<string, Anthropic.MessageParam[]>();

// ── POST /api/agent-setup/chat ────────────────────────────────────────────────

agentSetupRouter.post("/chat", async (req: Request, res: Response) => {
  const { clientId, message } = req.body as { clientId: string; message: string };
  if (!clientId || !message) {
    res.status(400).json({ error: "clientId and message required" });
    return;
  }

  // Load current config so the agent knows what's already set
  const { data: current } = await supabase
    .from("agent_config")
    .select("*")
    .eq("client_id", clientId)
    .single();

  const config = current ?? { ...DEFAULT_CONFIG, client_id: clientId };

  // Load client name
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();

  const clientName = client?.name ?? "the user";

  const systemPrompt = `You are a friendly AI configuration assistant helping ${clientName} customize their personal Mars AI agent.

CURRENT AGENT CONFIG:
- Name: ${config.agent_name}
- Personality: ${config.personality}
- Communication style: ${config.communication_style}
- Focus areas: ${(config.focus_areas ?? []).join(", ") || "none set"}
- Custom instructions: ${config.custom_instructions || "none"}
- Tools enabled: ${(config.tools_enabled ?? []).join(", ")}

Your job:
1. Listen to what the client wants to change about their agent.
2. When they request a change, call update_agent_config with ONLY the fields that need updating.
3. After applying the change, confirm in plain language what you changed — keep it brief and friendly.
4. If they describe their business/life context ("I run a gym", "I'm a day trader"), capture that in custom_instructions AND adjust focus_areas and personality accordingly.
5. If they just want to chat or ask questions, answer helpfully without calling the tool.
6. Never make up tool results — only report what the tool returns.

Keep responses short and conversational. The client is on mobile.`;

  const history = histories.get(clientId) ?? [];
  history.push({ role: "user", content: message });

  let appliedChanges: Record<string, unknown> | null = null;
  let finalReply = "";

  // Agentic loop: keep going until the model stops calling tools
  let loopHistory = [...history];
  while (true) {
    const response = await anthropic.messages.create({
      model:      "claude-opus-4-6",
      max_tokens: 1024,
      system:     systemPrompt,
      tools:      [UPDATE_CONFIG_TOOL],
      messages:   loopHistory,
    });

    if (response.stop_reason === "tool_use") {
      const toolUseBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!toolUseBlock) break;

      const patch = toolUseBlock.input as Record<string, unknown>;
      appliedChanges = patch;

      // Apply the patch via PATCH endpoint logic (direct DB call)
      const base = config as Record<string, unknown>;
      const update: Record<string, unknown> = { client_id: clientId, updated_at: new Date().toISOString() };
      const allowed = [
        "agent_name", "personality", "communication_style",
        "focus_areas", "custom_instructions", "elevenlabs_voice_id",
        "tavus_replica_id", "tools_enabled",
      ];
      for (const key of allowed) {
        update[key] = patch[key] !== undefined ? patch[key] : base[key];
      }
      await supabase.from("agent_config").upsert(update, { onConflict: "client_id" });

      // Feed tool result back
      loopHistory = [
        ...loopHistory,
        { role: "assistant" as const, content: response.content },
        {
          role: "user" as const,
          content: [{
            type: "tool_result" as const,
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify({ ok: true, applied: patch }),
          }],
        },
      ];
      // Continue loop to get the assistant's final natural-language reply
    } else {
      // stop_reason === "end_turn"
      finalReply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      loopHistory.push({ role: "assistant", content: finalReply });
      break;
    }
  }

  // Persist updated history (cap at 20 turns to avoid bloat)
  const updatedHistory = loopHistory.slice(-20);
  histories.set(clientId, updatedHistory);

  res.json({
    reply: finalReply,
    configUpdated: appliedChanges !== null,
    changes: appliedChanges,
  });
});

// ── GET /api/agent-setup/reset/:clientId  (clear conversation history) ────────
agentSetupRouter.get("/reset/:clientId", (req: Request, res: Response) => {
  histories.delete(req.params.clientId);
  res.json({ ok: true });
});
