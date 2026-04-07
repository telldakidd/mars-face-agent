/**
 * Polymarket API connector.
 * Uses stubs and mock data in place of live API calls.
 */
export class PolymarketConnector {
  private apiKey: string;
  private secret: string;

  constructor(
    apiKey = process.env.POLYMARKET_API_KEY ?? "",
    secret = process.env.POLYMARKET_SECRET ?? ""
  ) {
    this.apiKey = apiKey;
    this.secret = secret;
  }

  /**
   * Search for prediction markets matching a query.
   * @param query - Optional search string to filter markets.
   * @returns Array of mock market objects.
   */
  async getMarkets(query?: string): Promise<PolyMarket[]> {
    console.log(`[polymarket] Fetching markets (query=${query ?? "all"}, mock)...`);
    const markets: PolyMarket[] = [
      {
        id: "mkt-btc-100k",
        question: "Will Bitcoin reach $100k by end of 2026?",
        yesPrice: 0.62,
        noPrice: 0.38,
        volume: 2_450_000,
        endDate: "2026-12-31T23:59:59Z",
      },
      {
        id: "mkt-fed-rate",
        question: "Will the Fed cut rates in Q2 2026?",
        yesPrice: 0.45,
        noPrice: 0.55,
        volume: 1_230_000,
        endDate: "2026-06-30T23:59:59Z",
      },
      {
        id: "mkt-eth-merge",
        question: "Will Ethereum flip Bitcoin market cap by 2027?",
        yesPrice: 0.08,
        noPrice: 0.92,
        volume: 890_000,
        endDate: "2027-01-01T23:59:59Z",
      },
    ];

    if (query) {
      const q = query.toLowerCase();
      return markets.filter((m) => m.question.toLowerCase().includes(q));
    }
    return markets;
  }

  /**
   * Get current open positions.
   * @returns Array of mock position objects.
   */
  async getPositions(): Promise<PolyPosition[]> {
    console.log("[polymarket] Fetching positions (mock)...");
    return [
      {
        marketId: "mkt-btc-100k",
        outcome: "YES",
        shares: 150,
        avgPrice: 0.58,
        currentPrice: 0.62,
        pnl: 6.0,
      },
    ];
  }

  /**
   * Place a trade on a prediction market.
   * @param marketId - The market to trade on.
   * @param outcome - "YES" or "NO".
   * @param amount - USD amount to spend.
   * @returns Mock order result.
   */
  async placeTrade(
    marketId: string,
    outcome: "YES" | "NO",
    amount: number
  ): Promise<PolyOrderResult> {
    console.log(
      `[polymarket] Placing ${outcome} $${amount} on ${marketId} (mock)`
    );
    const price = outcome === "YES" ? 0.62 : 0.38;
    return {
      orderId: `poly-${Date.now()}`,
      marketId,
      outcome,
      amount,
      price,
      shares: amount / price,
      status: "filled",
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * Get the current price for a specific market.
   * @param marketId - The market ID to query.
   * @returns Mock price data.
   */
  async getMarketPrice(marketId: string): Promise<PolyPrice> {
    console.log(`[polymarket] Getting price for ${marketId} (mock)...`);
    return {
      marketId,
      yesPrice: 0.62,
      noPrice: 0.38,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// ── Types ────────────────────────────────────────────────

export interface PolyMarket {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  endDate: string;
}

export interface PolyPosition {
  marketId: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
}

export interface PolyOrderResult {
  orderId: string;
  marketId: string;
  outcome: string;
  amount: number;
  price: number;
  shares: number;
  status: string;
  executedAt: string;
}

export interface PolyPrice {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  lastUpdated: string;
}
