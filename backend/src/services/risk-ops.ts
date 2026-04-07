import { supabase } from "../lib/supabase.js";

/**
 * Risk operations service.
 * Validates trades against risk rules and monitors portfolio health.
 */

// ── Constants ────────────────────────────────────────────

const RISK_LIMITS: Record<string, RiskLimits> = {
  conservative: {
    maxPositionSizePct: 0.02, // 2% of equity per position
    maxDailyDrawdownPct: 0.03, // 3% daily drawdown pause
    maxOpenPositions: 3,
    maxCorrelatedPositions: 2,
  },
  moderate: {
    maxPositionSizePct: 0.05, // 5% per position
    maxDailyDrawdownPct: 0.06, // 6% daily drawdown pause
    maxOpenPositions: 6,
    maxCorrelatedPositions: 3,
  },
  aggressive: {
    maxPositionSizePct: 0.1, // 10% per position
    maxDailyDrawdownPct: 0.1, // 10% daily drawdown pause
    maxOpenPositions: 10,
    maxCorrelatedPositions: 5,
  },
};

const DEFAULT_EQUITY = 10_000; // fallback equity for calculations

// ── Types ────────────────────────────────────────────────

export interface RiskLimits {
  maxPositionSizePct: number;
  maxDailyDrawdownPct: number;
  maxOpenPositions: number;
  maxCorrelatedPositions: number;
}

export interface TradeRequest {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  platform: string;
}

export interface RiskCheckResult {
  allowed: boolean;
  reasons: string[];
}

// ── Service ──────────────────────────────────────────────

export class RiskOpsService {
  /**
   * Validate a proposed trade against the client's risk rules.
   * Checks max position size, daily drawdown, and diversification.
   */
  async checkPosition(
    clientId: string,
    trade: TradeRequest
  ): Promise<RiskCheckResult> {
    const reasons: string[] = [];
    const profile = await this.getRiskProfile(clientId);
    const limits = profile.limits;
    const equity = profile.equity;

    // 1) Max position size check
    const positionValue = trade.qty * trade.price;
    const maxAllowed = equity * limits.maxPositionSizePct;
    if (positionValue > maxAllowed) {
      reasons.push(
        `Position value $${positionValue.toFixed(2)} exceeds max $${maxAllowed.toFixed(2)} (${(limits.maxPositionSizePct * 100).toFixed(0)}% of equity)`
      );
    }

    // 2) Daily drawdown check
    const dailyPnl = await this.getDailyPnL(clientId);
    const maxDrawdown = equity * limits.maxDailyDrawdownPct;
    if (dailyPnl < 0 && Math.abs(dailyPnl) >= maxDrawdown) {
      reasons.push(
        `Daily drawdown $${Math.abs(dailyPnl).toFixed(2)} has reached limit $${maxDrawdown.toFixed(2)}`
      );
    }

    // 3) Diversification: count today's distinct symbols
    const { data: todayTrades } = await supabase
      .from("trade_log")
      .select("symbol")
      .eq("client_id", clientId)
      .gte("executed_at", todayStart());

    const uniqueSymbols = new Set(
      (todayTrades ?? []).map((t) => t.symbol)
    );
    uniqueSymbols.add(trade.symbol);
    if (uniqueSymbols.size > limits.maxOpenPositions) {
      reasons.push(
        `Would exceed max ${limits.maxOpenPositions} open positions`
      );
    }

    return {
      allowed: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Sum today's realized PnL from the trade log.
   */
  async getDailyPnL(clientId: string): Promise<number> {
    const { data, error } = await supabase
      .from("trade_log")
      .select("pnl")
      .eq("client_id", clientId)
      .gte("executed_at", todayStart());

    if (error || !data) return 0;
    return data.reduce((sum, row) => sum + (Number(row.pnl) || 0), 0);
  }

  /**
   * Returns true if the client's daily drawdown exceeds the pause threshold.
   */
  async shouldPause(clientId: string): Promise<boolean> {
    const profile = await this.getRiskProfile(clientId);
    const dailyPnl = await this.getDailyPnL(clientId);
    const maxDrawdown = profile.equity * profile.limits.maxDailyDrawdownPct;
    return dailyPnl < 0 && Math.abs(dailyPnl) >= maxDrawdown;
  }

  /**
   * Fetch the client's risk tier and compute applicable limits.
   */
  async getRiskProfile(
    clientId: string
  ): Promise<{ tier: string; limits: RiskLimits; equity: number }> {
    const { data: client } = await supabase
      .from("clients")
      .select("risk_tier")
      .eq("id", clientId)
      .single();

    const tier = client?.risk_tier ?? "moderate";
    const limits = RISK_LIMITS[tier] ?? RISK_LIMITS.moderate;

    // In production, fetch real equity from MT5 connector
    const equity = DEFAULT_EQUITY;

    return { tier, limits, equity };
  }
}

// ── Helpers ──────────────────────────────────────────────

function todayStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
