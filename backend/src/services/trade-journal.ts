import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function writeTradeJournal(clientId: string, tradeId: string): Promise<string> {
  // Fetch the trade
  const { data: trade, error } = await supabase
    .from("trade_log")
    .select("symbol, side, qty, price, pnl, strategy, platform, executed_at, metadata")
    .eq("id", tradeId)
    .eq("client_id", clientId)
    .single();

  if (error || !trade) {
    throw new Error("Trade not found");
  }

  const pnlStr = trade.pnl != null
    ? `${trade.pnl >= 0 ? "+" : ""}$${Number(trade.pnl).toFixed(2)}`
    : "unknown P&L";

  const prompt = `Write a concise 2-3 sentence trade journal entry for this completed trade.

Trade details:
- Asset: ${trade.symbol}
- Direction: ${trade.side.toUpperCase()}
- Quantity: ${trade.qty}
- Entry price: ${trade.price}
- P&L: ${pnlStr}
- Strategy: ${trade.strategy ?? "manual"}
- Platform: ${trade.platform}
- Time: ${new Date(trade.executed_at).toLocaleString()}

Focus on: what likely drove the outcome, whether the strategy performed as expected, and one actionable takeaway.
Keep the tone professional but direct. No fluff.`;

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const journal = (msg.content[0] as { type: string; text: string }).text.trim();

  // Save to agent_activity
  await supabase.from("agent_activity").insert({
    client_id: clientId,
    action_type: "trade_journal",
    description: journal,
    confidence: 1.0,
    metadata: { trade_id: tradeId, symbol: trade.symbol, pnl: trade.pnl },
  });

  return journal;
}
