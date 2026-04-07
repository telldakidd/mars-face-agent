import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase.js";
import { MT5Connector } from "../connectors/mt5.js";
import { broadcastToClient } from "../websocket.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
const mt5 = new MT5Connector();

export async function generateMorningBriefing(clientId: string): Promise<{
  summary: string;
  marketOutlook: string;
  botStatus: string;
  pnlOvernight: number;
}> {
  await mt5.connect();
  const [account, positions] = await Promise.all([
    mt5.getAccountInfo().catch(() => null),
    mt5.getPositions().catch(() => []),
  ]);

  // Get overnight trades
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const { data: trades } = await supabase
    .from("trade_log")
    .select("*")
    .eq("client_id", clientId)
    .gte("executed_at", yesterday.toISOString())
    .order("executed_at", { ascending: false });

  const pnlOvernight = (trades ?? []).reduce((s: number, t: { pnl: number }) => s + (t.pnl ?? 0), 0);
  const openPnl = positions.reduce((s, p) => s + p.profit, 0);
  const basketRunning = positions.filter(p => p.magic === 20251222).length > 0;

  const prompt = `Generate a concise morning trading briefing (3-4 sentences max) for a professional trader.

Account status:
- Balance: $${account?.balance?.toFixed(2) ?? "N/A"}
- Equity: $${account?.equity?.toFixed(2) ?? "N/A"}
- Open positions: ${positions.length}
- BasketBot: ${basketRunning ? "Running" : "Stopped"}
- Overnight P&L: ${pnlOvernight >= 0 ? "+" : ""}$${pnlOvernight.toFixed(2)}
- Open P&L: ${openPnl >= 0 ? "+" : ""}$${openPnl.toFixed(2)}
- Trades last 24h: ${trades?.length ?? 0}

Be direct, professional, confident. Start with the key number. Mention what needs attention.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const summary = response.content[0].type === "text" ? response.content[0].text : "";
  const botStatus = basketRunning
    ? `Running — ${positions.filter(p => p.magic === 20251222).length} positions`
    : "Stopped";

  // Push to device via WebSocket
  broadcastToClient(clientId, {
    type: "morning_briefing",
    summary,
    pnlOvernight,
    botStatus,
    timestamp: new Date().toISOString(),
  });

  // Store as agent activity
  await supabase.from("agent_activity").insert({
    client_id: clientId,
    action_type: "briefing",
    description: summary.slice(0, 100),
    confidence: 1.0,
    metadata: { pnl_overnight: pnlOvernight, bot_running: basketRunning },
  });

  return {
    summary,
    marketOutlook: `${positions.length} open positions, ${basketRunning ? "bot active" : "bot stopped"}`,
    botStatus,
    pnlOvernight,
  };
}

// Run briefings for ALL clients at 7am daily
export async function runDailyBriefings(): Promise<void> {
  const { data: clients } = await supabase.from("clients").select("id, name");
  if (!clients) return;
  for (const client of clients) {
    try {
      await generateMorningBriefing(client.id);
      console.log(`[briefing] Generated for ${client.name}`);
    } catch (e) {
      console.error(`[briefing] Failed for ${client.id}:`, (e as Error).message);
    }
  }
}
