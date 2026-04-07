/**
 * MetaApi (MT5) connector.
 * Supports real MetaApi SDK calls + BasketBot EA control.
 */

let MetaApi: unknown;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MetaApi = require("metaapi.cloud-sdk").default;
} catch {
  MetaApi = null;
}

export class MT5Connector {
  private token: string;
  private accountId: string;
  private connected = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private account: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private connection: any = null;

  constructor(
    token = process.env.METAAPI_TOKEN ?? "",
    accountId = process.env.METAAPI_ACCOUNT_ID ?? ""
  ) {
    this.token = token;
    this.accountId = accountId;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (!MetaApi || !this.token) {
      console.log("[mt5] MetaApi SDK not available — using stubs");
      this.connected = true;
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = new (MetaApi as any)(this.token);
      this.account = await api.metatraderAccountApi.getAccount(this.accountId);
      if (this.account.state !== "DEPLOYED") {
        await this.account.deploy();
        await this.account.waitDeployed();
      }
      this.connection = this.account.getRPCConnection();
      await this.connection.connect();
      await this.connection.waitSynchronized();
      this.connected = true;
      console.log("[mt5] Connected to MetaApi account.");
    } catch (err) {
      console.error("[mt5] Connection failed, using stubs:", (err as Error).message);
      this.connected = true;
    }
  }

  // ── BasketBot EA Control ────────────────────────────────────────────────────

  async startBasketBot(symbol: string): Promise<void> {
    console.log(`[mt5] Starting BasketBot on ${symbol}`);
    if (!this.connection) return;
    await this.connection.createMarketBuyOrder(symbol, 0, {
      comment: "BasketBot_Start",
    }).catch(() => {});
    // In production: use MetaApi EA deployment or execute script
  }

  async stopBasketBot(): Promise<void> {
    console.log("[mt5] Stopping BasketBot");
    if (!this.connection) return;
    // Close all BasketBot positions (magic number 20251222)
    const positions = await this.getPositions();
    for (const pos of positions) {
      if (pos.magic === 20251222) {
        await this.connection.closePosition(pos.id).catch(() => {});
      }
    }
  }

  async setParam(param: string, value: unknown): Promise<void> {
    console.log(`[mt5] Setting BasketBot ${param} = ${value}`);
    if (!this.connection) return;
    // Send parameter change via MetaApi execute_program or custom script
    // In production: deploy an EA update or use MetaApi's input override API
    await this.connection.executeProgram?.({
      name: "SetBasketBotParam",
      params: { param, value: String(value) },
    }).catch(() => {});
  }

  // ── Standard MT5 Operations ────────────────────────────────────────────────

  async getPositions(): Promise<MT5Position[]> {
    if (!this.connection) {
      return [
        {
          id: "pos-001", symbol: "XAUUSD", type: "buy", volume: 0.1,
          openPrice: 2345.5, currentPrice: 2352.3, profit: 68.0,
          swap: -1.2, openTime: new Date().toISOString(), magic: 20251222,
        },
      ];
    }
    try {
      const positions = await this.connection.getPositions();
      return positions.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any): MT5Position => ({
          id: p.id,
          symbol: p.symbol,
          type: p.type === "POSITION_TYPE_BUY" ? "buy" : "sell",
          volume: p.volume,
          openPrice: p.openPrice,
          currentPrice: p.currentPrice,
          profit: p.profit,
          swap: p.swap ?? 0,
          openTime: p.time,
          magic: p.magic,
        })
      );
    } catch {
      return [];
    }
  }

  async placeTrade(
    symbol: string,
    side: "buy" | "sell",
    volume: number,
    sl?: number,
    tp?: number
  ): Promise<MT5OrderResult> {
    console.log(`[mt5] ${side} ${volume} ${symbol}`);
    if (!this.connection) {
      return {
        orderId: `mock-${Date.now()}`, symbol, side, volume,
        price: 2350.0, sl: sl ?? null, tp: tp ?? null,
        status: "filled", executedAt: new Date().toISOString(),
      };
    }
    const fn = side === "buy"
      ? this.connection.createMarketBuyOrder.bind(this.connection)
      : this.connection.createMarketSellOrder.bind(this.connection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order: any = await fn(symbol, volume, sl, tp);
    return {
      orderId: order.orderId ?? String(Date.now()),
      symbol, side, volume,
      price: order.openPrice ?? 0,
      sl: sl ?? null, tp: tp ?? null,
      status: "filled",
      executedAt: new Date().toISOString(),
    };
  }

  async getAccountInfo(): Promise<MT5AccountInfo> {
    if (!this.connection) {
      return {
        balance: 10000.0, equity: 10074.5, margin: 234.55,
        freeMargin: 9839.95, marginLevel: 4295.2, currency: "USD", leverage: 100,
      };
    }
    try {
      const info = await this.connection.getAccountInformation();
      return {
        balance: info.balance,
        equity: info.equity,
        margin: info.margin,
        freeMargin: info.freeMargin,
        marginLevel: info.marginLevel,
        currency: info.currency ?? "USD",
        leverage: info.leverage ?? 100,
      };
    } catch {
      return {
        balance: 0, equity: 0, margin: 0,
        freeMargin: 0, marginLevel: 0, currency: "USD", leverage: 100,
      };
    }
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MT5Position {
  id: string;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  swap: number;
  openTime: string;
  magic?: number;
}

export interface MT5OrderResult {
  orderId: string;
  symbol: string;
  side: string;
  volume: number;
  price: number;
  sl: number | null;
  tp: number | null;
  status: string;
  executedAt: string;
}

export interface MT5AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: number;
}
