import { supabase } from "../lib/supabase.js";

export interface ClientMemory {
  preferences: string[];
  tradingHistory: string;
  riskNotes: string;
  lastUpdated: string;
}

// Load persistent memory for a client from their conversation + activity history
export async function loadClientMemory(clientId: string): Promise<string> {
  const { data: activities } = await supabase
    .from("agent_activity")
    .select("action_type, description, metadata, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: trades } = await supabase
    .from("trade_log")
    .select("symbol, side, pnl, strategy, executed_at")
    .eq("client_id", clientId)
    .order("executed_at", { ascending: false })
    .limit(20);

  const { data: client } = await supabase
    .from("clients")
    .select("name, risk_tier, subscription_tier, voice_to_voice_enabled")
    .eq("id", clientId)
    .single();

  if (!client) return "";

  const recentActivity = (activities ?? [])
    .slice(0, 10)
    .map((a) => `- ${a.action_type}: ${a.description}`)
    .join("\n");

  const tradeSummary = (trades ?? [])
    .slice(0, 5)
    .map((t) => `${t.symbol} ${t.side} ${t.pnl >= 0 ? "+" : ""}$${t.pnl?.toFixed(2)} (${t.strategy})`)
    .join(", ");

  return `
CLIENT MEMORY for ${client.name}:
- Risk tier: ${client.risk_tier}
- Subscription: ${client.subscription_tier}
- Voice-to-voice: ${client.voice_to_voice_enabled ? "enabled" : "disabled"}
- Recent activity: ${recentActivity || "none"}
- Recent trades: ${tradeSummary || "none"}
`.trim();
}

// Save a notable memory/preference for a client
export async function saveClientNote(
  clientId: string,
  note: string,
  category: "preference" | "risk" | "trade_insight"
): Promise<void> {
  await supabase.from("agent_activity").insert({
    client_id: clientId,
    action_type: `memory_${category}`,
    description: note,
    confidence: 1.0,
    metadata: { category, auto_saved: true },
  });
}
