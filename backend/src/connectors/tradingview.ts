/**
 * TradingView webhook connector.
 * Parses incoming alerts and validates the shared secret/passphrase.
 */

export interface TradingViewSignal {
  symbol: string;
  side: "buy" | "sell";
  price: number;
  timeframe: string;
  strategy: string;
  confidence: number;
}

/**
 * Parse a TradingView webhook JSON body into a structured signal.
 * Handles both standard TradingView alert format and custom JSON payloads.
 * @param body - Raw request body from TradingView webhook.
 * @returns Parsed signal with symbol, side, price, timeframe, strategy, confidence.
 */
export function parseAlert(body: Record<string, unknown>): TradingViewSignal {
  // TradingView alerts can arrive in various formats depending on
  // how the user configured the alert message. We normalize here.

  const ticker = (body.ticker ?? body.symbol ?? "UNKNOWN") as string;
  const action = ((body.action ?? body.order ?? body.side ?? "buy") as string).toLowerCase();
  const side: "buy" | "sell" = action.includes("sell") || action.includes("short") ? "sell" : "buy";

  const price = Number(body.price ?? body.close ?? 0);
  const timeframe = (body.timeframe ?? body.interval ?? "1h") as string;
  const strategy = (body.strategy_name ?? body.strategy ?? "unknown") as string;
  const confidence = Number(body.confidence ?? 0.5);

  return {
    symbol: ticker.toUpperCase(),
    side,
    price,
    timeframe,
    strategy,
    confidence: Math.min(1, Math.max(0, confidence)),
  };
}

/**
 * Validate that the passphrase in the webhook body matches the expected secret.
 * @param body - Raw request body containing a `passphrase` field.
 * @param secret - The expected TRADINGVIEW_WEBHOOK_SECRET.
 * @returns true if passphrase matches.
 */
export function validateSecret(
  body: Record<string, unknown>,
  secret: string
): boolean {
  return typeof body.passphrase === "string" && body.passphrase === secret;
}
