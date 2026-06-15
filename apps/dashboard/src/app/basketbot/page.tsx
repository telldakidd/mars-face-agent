"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import CompoundCalculator from "./compound-calculator";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface BotStatus {
  bot?: string;
  balance?: number;
  equity?: number;
  floating_pnl?: number;
  hwm?: number;
  dd_from_hwm_pct?: number;
  daily_pnl_pct?: number;
  weekly_pnl_pct?: number;
  monthly_pnl_pct?: number;
  positions?: number;
  buy_lots?: number;
  sell_lots?: number;
  net_exposure_pct?: number;
  phase?: string;
  kill_switch?: boolean;
  lot_reduction_active?: boolean;
  daily_loss_pct?: number;
  trades_today?: number;
  total_trades?: number;
  total_wins?: number;
  win_rate?: number;
  base_lot_current?: number;
  last_heartbeat?: string;
  status?: string;
}

interface MT5Account {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: number;
}

interface MT5Position {
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

interface MT5Data {
  account?: MT5Account;
  basketPositions?: MT5Position[];
  allPositions?: MT5Position[];
  fetchedAt?: string;
  error?: string;
}

interface Trade {
  id: string;
  symbol: string;
  side?: string;
  lots?: number;
  entry?: number;
  exit_price?: number;
  pnl?: number;
  status: string;
  opened_at: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null, d = 2): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtPct(n: number | undefined | null): string {
  if (n === undefined || n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function isLive(ts?: string) {
  return !!ts && Date.now() - new Date(ts).getTime() < 120_000;
}

function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// Flash class applied briefly when a value changes
function useFlash(value: unknown) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value && prev.current !== undefined) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 650);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return flash ? "value-flash" : "";
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = "text-white", accent = "from-neon-cyan/20", glow = false, danger = false,
}: {
  label: string; value: string; sub?: string;
  color?: string; accent?: string; glow?: boolean; danger?: boolean;
}) {
  const flashCls = useFlash(value);
  return (
    <div className={`bracket-corners border bg-dark-card/80 p-4 relative overflow-hidden ${
      danger ? "border-neon-red/30 card-danger-glow bracket-corners-red"
      : glow ? "border-neon-cyan/15 card-glow"
      : "border-white/5"
    }`}>
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${accent} to-transparent`} />
      <p className="text-[9px] text-white/25 font-mono uppercase tracking-[0.3em] mb-2">{label}</p>
      <p className={`text-2xl font-bold font-mono leading-none ${color} ${flashCls}`}>{value}</p>
      {sub && <p className="text-[9px] text-white/20 font-mono mt-1.5">{sub}</p>}
    </div>
  );
}

function SectionLabel({ code, label, color = "text-neon-cyan/30" }: { code: string; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className={`h-px flex-1 bg-gradient-to-r from-current to-transparent opacity-20`} />
      <span className={`text-[9px] font-mono tracking-[0.4em] uppercase ${color}`}>{code}://{label}</span>
      <div className={`h-px flex-1 bg-gradient-to-l from-current to-transparent opacity-20`} />
    </div>
  );
}

function MarginGauge({ level }: { level: number | undefined }) {
  if (!level) return <div className="text-white/20 text-xs font-mono">—</div>;
  const pct = Math.min(level / 10, 100); // 0–1000% shown as 0–100% bar
  const color = level > 200 ? "bg-neon-green" : level > 100 ? "bg-neon-amber" : "bg-neon-red";
  return (
    <div>
      <div className="flex justify-between text-[9px] font-mono mb-1">
        <span className="text-white/30">MARGIN LEVEL</span>
        <span className={level > 200 ? "text-neon-green" : level > 100 ? "text-neon-amber" : "text-neon-red"}>
          {fmt(level)}%
        </span>
      </div>
      <div className="h-1 bg-white/5 w-full relative overflow-hidden">
        <div
          className={`bar-fill h-full ${color} transition-all duration-700`}
          style={{ "--bar-w": `${pct}%` } as React.CSSProperties}
        />
        <div className="absolute inset-0 bar-segments" />
      </div>
    </div>
  );
}

function LotBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono mb-1">
        <span className={color}>{label}</span>
        <span className="text-white/50">{fmt(value, 4)}</span>
      </div>
      <div className="h-1.5 bg-white/5 w-full relative overflow-hidden">
        <div
          className={`bar-fill h-full transition-all duration-700 ${color === "text-neon-green" ? "bg-neon-green" : "bg-neon-red"}`}
          style={{ "--bar-w": `${pct}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

function Ticker({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) return null;
  const items = [...trades, ...trades]; // duplicate for seamless loop
  return (
    <div className="border-t border-b border-neon-cyan/5 bg-black/40 overflow-hidden h-8 flex items-center relative">
      <div className="absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-void to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-void to-transparent" />
      <div className="ticker-scroll flex gap-8 px-4">
        {items.map((t, i) => (
          <span key={`${t.id}-${i}`} className="text-[10px] font-mono whitespace-nowrap flex items-center gap-2">
            <span className="text-white/20">//</span>
            <span className="text-white/50">{t.symbol}</span>
            <span className={t.side === "buy" ? "text-neon-green" : t.side === "sell" ? "text-neon-red" : "text-white/30"}>
              {(t.side ?? "?").toUpperCase()}
            </span>
            <span className="text-white/30">{fmt(t.lots, 2)}L</span>
            {t.pnl !== undefined && (
              <span className={t.pnl >= 0 ? "text-neon-green" : "text-neon-red"}>
                {t.pnl >= 0 ? "+" : ""}${fmt(t.pnl)}
              </span>
            )}
            <span className="text-white/10">{timeAgo(t.opened_at)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function BasketBotPage() {
  const [bot, setBot] = useState<BotStatus>({});
  const [mt5, setMt5] = useState<MT5Data>({});
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tick, setTick] = useState(0); // 1-second clock
  const [mt5Error, setMt5Error] = useState(false);

  const loadBot = useCallback(async () => {
    try {
      const [bRes, tRes] = await Promise.all([
        fetch(`${API}/api/basketbot/live`),
        fetch(`${API}/api/basketbot/trade-history`),
      ]);
      if (bRes.ok) setBot(await bRes.json());
      if (tRes.ok) setTrades(await tRes.json());
    } catch { /* keep stale */ }
  }, []);

  const loadMt5 = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/basketbot/mt5`);
      if (res.ok) { setMt5(await res.json()); setMt5Error(false); }
      else setMt5Error(true);
    } catch { setMt5Error(true); }
  }, []);

  useEffect(() => {
    loadBot();
    loadMt5();
    const botId = setInterval(loadBot, 5_000);
    const mt5Id = setInterval(loadMt5, 10_000);
    const tickId = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(botId); clearInterval(mt5Id); clearInterval(tickId); };
  }, [loadBot, loadMt5]);

  const live = isLive(bot.last_heartbeat);
  const offline = !bot.bot;
  const maxLots = Math.max(bot.buy_lots ?? 0, bot.sell_lots ?? 0, 0.01);
  const acc = mt5.account;
  const bpos = mt5.basketPositions ?? [];
  const totalFloat = bpos.reduce((s, p) => s + p.profit, 0);

  const ddColor = (v?: number) =>
    !v ? "text-white/40" : v > 10 ? "text-neon-red" : v > 5 ? "text-neon-amber" : "text-neon-green";

  const pnlColor = (v?: number | null) =>
    v === undefined || v === null ? "text-white/40" : v >= 0 ? "text-neon-green" : "text-neon-red";

  // uptime counter display
  const heartbeatSec = bot.last_heartbeat
    ? Math.floor((Date.now() - new Date(bot.last_heartbeat).getTime()) / 1000)
    : null;

  void tick; // consumed by heartbeatSec recalc on render

  return (
    <div className="min-h-screen text-white font-mono">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="relative border-b border-neon-cyan/10 bg-black/60 px-8 py-6 overflow-hidden">
        <div className="scan-line" />
        {/* data stream lines */}
        <div className="data-stream-line stream-pos-1" />
        <div className="data-stream-line stream-pos-2" />
        <div className="data-stream-line stream-pos-3" />

        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-[9px] tracking-[0.6em] text-neon-cyan/30 uppercase mb-2">
              SYS://MARS.ALGO.TRADING // TERMINAL v3.0
            </p>
            <h1
              className="text-5xl font-bold tracking-widest glitch-text text-neon-cyan text-neon-glow"
              data-text="BASKETBOT"
            >
              BASKETBOT
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-[10px] text-white/20 tracking-widest">MAGIC: 20251222</span>
              <span className="text-white/10">|</span>
              <span className="text-[10px] text-white/20 tracking-widest">BOT: ARGOMARSBOT</span>
              {bot.phase && (
                <>
                  <span className="text-white/10">|</span>
                  <span className="text-[10px] text-neon-amber tracking-widest">PHASE: {bot.phase}</span>
                </>
              )}
            </div>
          </div>

          {/* Status cluster */}
          <div className="flex flex-col items-end gap-2">
            {/* EA link */}
            <div className={`flex items-center gap-2 border px-3 py-1.5 text-[10px] font-mono ${
              offline ? "border-white/10 text-white/20"
              : live ? "border-neon-cyan/20 bg-neon-cyan/5 text-neon-cyan"
              : "border-neon-red/20 bg-neon-red/5 text-neon-red"
            }`}>
              <span className={`h-1.5 w-1.5 ${
                offline ? "bg-white/15"
                : live ? "bg-neon-cyan status-pulse"
                : "bg-neon-red"
              }`} />
              EA: {offline ? "OFFLINE" : live ? "LIVE" : "STALE"}
              {heartbeatSec !== null && (
                <span className="text-white/30 ml-1">[{heartbeatSec}s]</span>
              )}
            </div>

            {/* MT5 link */}
            <div className={`flex items-center gap-2 border px-3 py-1.5 text-[10px] font-mono ${
              mt5Error ? "border-neon-red/20 bg-neon-red/5 text-neon-red/70"
              : acc ? "border-neon-green/20 bg-neon-green/5 text-neon-green"
              : "border-white/10 text-white/20"
            }`}>
              <span className={`h-1.5 w-1.5 ${
                mt5Error ? "bg-neon-red" : acc ? "bg-neon-green status-pulse" : "bg-white/15"
              }`} />
              MT5: {mt5Error ? "ERROR" : acc ? "CONNECTED" : "LOADING..."}
            </div>

            {/* Kill switch alert */}
            {bot.kill_switch && (
              <div className="flex items-center gap-2 border border-neon-red/50 bg-neon-red/10 px-3 py-1.5 text-[10px] font-mono text-neon-red card-danger-glow">
                <span className="h-1.5 w-1.5 bg-neon-red status-pulse" />
                KILL SWITCH TRIPPED
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── TRADE TICKER ─────────────────────────────────────────────────── */}
      <Ticker trades={trades} />

      <div className="px-8 py-6 space-y-5">

        {/* ── TOP STATS (4 mega cards) ──────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="ACCOUNT BALANCE"
            value={acc ? `$${fmt(acc.balance)}` : bot.balance ? `$${fmt(bot.balance)}` : "—"}
            sub={acc ? `${acc.currency} // ${acc.leverage}:1 leverage` : undefined}
            color="text-white text-neon-glow"
            accent="from-neon-cyan/25"
            glow
          />
          <StatCard
            label="EQUITY"
            value={acc ? `$${fmt(acc.equity)}` : bot.equity ? `$${fmt(bot.equity)}` : "—"}
            sub={acc ? `Free margin: $${fmt(acc.freeMargin)}` : undefined}
            color="text-neon-cyan"
            accent="from-neon-cyan/20"
          />
          <StatCard
            label="FLOATING P&L"
            value={
              bpos.length > 0 ? `${totalFloat >= 0 ? "+" : ""}$${fmt(totalFloat)}`
              : bot.floating_pnl !== undefined ? `${(bot.floating_pnl ?? 0) >= 0 ? "+" : ""}$${fmt(bot.floating_pnl)}`
              : "—"
            }
            color={pnlColor(bpos.length > 0 ? totalFloat : bot.floating_pnl)}
            accent={`from-${(bpos.length > 0 ? totalFloat : (bot.floating_pnl ?? 0)) >= 0 ? "neon-green" : "neon-red"}/20`}
            glow={(bpos.length > 0 ? totalFloat : (bot.floating_pnl ?? 0)) > 0}
            danger={(bpos.length > 0 ? totalFloat : (bot.floating_pnl ?? 0)) < -50}
          />
          <StatCard
            label="DD FROM HWM"
            value={`${fmt(bot.dd_from_hwm_pct)}%`}
            sub={`HWM: $${fmt(bot.hwm)}`}
            color={ddColor(bot.dd_from_hwm_pct)}
            accent={`from-${(bot.dd_from_hwm_pct ?? 0) > 5 ? "neon-amber" : "neon-green"}/15`}
            danger={(bot.dd_from_hwm_pct ?? 0) > 10}
          />
        </div>

        {/* ── 3-COLUMN MIDDLE ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── LEFT: MT5 TERMINAL ───────────────────────────────────────── */}
          <div className={`bracket-corners border bg-dark-card/60 p-5 relative overflow-hidden hex-pattern ${
            acc ? "border-neon-green/10 card-glow" : "border-white/5"
          }`}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-green/30 to-transparent" />
            <SectionLabel code="MT5" label="TERMINAL" color="text-neon-green/40" />

            {mt5Error ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <p className="text-[10px] text-neon-red/50 font-mono tracking-widest">CONNECTION FAILED</p>
                <button
                  type="button"
                  onClick={loadMt5}
                  className="border border-neon-red/20 px-4 py-1.5 text-[9px] text-neon-red/60 hover:text-neon-red hover:border-neon-red/40 transition"
                >
                  RETRY
                </button>
              </div>
            ) : !acc ? (
              <p className="text-[10px] text-white/20 font-mono py-6 text-center cursor-blink">CONNECTING</p>
            ) : (
              <div className="space-y-4">
                {/* Account rows */}
                {[
                  { label: "BALANCE", value: `$${fmt(acc.balance)}`, color: "text-white" },
                  { label: "EQUITY", value: `$${fmt(acc.equity)}`, color: "text-neon-cyan" },
                  { label: "MARGIN USED", value: `$${fmt(acc.margin)}`, color: "text-neon-amber" },
                  { label: "FREE MARGIN", value: `$${fmt(acc.freeMargin)}`, color: "text-neon-green" },
                  { label: "LEVERAGE", value: `${acc.leverage}:1`, color: "text-white/60" },
                  { label: "CURRENCY", value: acc.currency, color: "text-white/40" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-baseline border-b border-white/[0.04] pb-2">
                    <span className="text-[9px] text-white/25 tracking-[0.2em]">{label}</span>
                    <span className={`text-sm font-bold ${color}`}>{value}</span>
                  </div>
                ))}

                <MarginGauge level={acc.marginLevel} />

                {mt5.fetchedAt && (
                  <p className="text-[8px] text-white/15 text-right">
                    updated {timeAgo(mt5.fetchedAt)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── CENTER: BASKET LIVE ───────────────────────────────────────── */}
          <div className="bracket-corners border border-neon-cyan/10 bg-dark-card/60 p-5 relative overflow-hidden card-glow">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/30 to-transparent" />
            <SectionLabel code="BASKET" label="LIVE" color="text-neon-cyan/40" />

            <div className="space-y-4">
              {/* Lot bars */}
              <div className="space-y-3">
                <LotBar label="BUY LOTS" value={bot.buy_lots ?? 0} max={maxLots} color="text-neon-green" />
                <LotBar label="SELL LOTS" value={bot.sell_lots ?? 0} max={maxLots} color="text-neon-red" />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/5">
                {[
                  { label: "OPEN POSITIONS", value: String(bot.positions ?? "—"), color: "text-white" },
                  { label: "NET EXPOSURE", value: `${fmt(bot.net_exposure_pct)}%`, color: pnlColor(bot.net_exposure_pct) },
                  { label: "BASE LOT", value: fmt(bot.base_lot_current, 4), color: "text-neon-cyan" },
                  { label: "BASKET POS", value: String(bpos.length), color: "text-neon-cyan" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-[8px] text-white/20 tracking-[0.2em] mb-0.5">{label}</p>
                    <p className={`text-sm font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/5 pt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "DAILY", value: fmtPct(bot.daily_pnl_pct), color: pnlColor(bot.daily_pnl_pct) },
                  { label: "WEEKLY", value: fmtPct(bot.weekly_pnl_pct), color: pnlColor(bot.weekly_pnl_pct) },
                  { label: "MONTHLY", value: fmtPct(bot.monthly_pnl_pct), color: pnlColor(bot.monthly_pnl_pct) },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center border border-white/5 py-2">
                    <p className="text-[8px] text-white/20 mb-1">{label}</p>
                    <p className={`text-xs font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "WIN RATE", value: `${fmt(bot.win_rate)}%` },
                  { label: "TODAY", value: String(bot.trades_today ?? "—") },
                  { label: "TOTAL", value: String(bot.total_trades ?? "—") },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-[8px] text-white/20 mb-0.5">{label}</p>
                    <p className="text-sm font-bold text-white/70">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: RISK MATRIX ───────────────────────────────────────── */}
          <div className={`border bg-dark-card/60 p-5 relative overflow-hidden ${
            bot.kill_switch
              ? "bracket-corners-red border-neon-red/30 card-danger-glow"
              : "bracket-corners border-white/5"
          }`}>
            <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${
              bot.kill_switch ? "from-neon-red/40" : "from-neon-amber/20"
            } to-transparent`} />
            <SectionLabel code="RISK" label="MATRIX" color="text-neon-amber/40" />

            <div className="space-y-3">
              {/* Kill switch */}
              <div className={`border p-3 relative overflow-hidden ${
                bot.kill_switch
                  ? "border-neon-red/40 bg-neon-red/5 warning-stripes"
                  : "border-white/5 bg-white/[0.01]"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/30 tracking-[0.2em]">KILL SWITCH</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 ${bot.kill_switch ? "bg-neon-red status-pulse" : "bg-neon-green/60"}`} />
                    <span className={`text-xs font-bold ${bot.kill_switch ? "text-neon-red" : "text-neon-green"}`}>
                      {bot.kill_switch ? "TRIPPED" : "CLEAR"}
                    </span>
                  </div>
                </div>
                {bot.kill_switch && (
                  <p className="text-[8px] text-neon-red/50 mt-1">MANUAL RESET REQUIRED</p>
                )}
              </div>

              {/* Lot reduction */}
              <div className={`border p-3 ${
                bot.lot_reduction_active
                  ? "border-neon-amber/30 bg-neon-amber/5 warning-stripes card-warn-glow"
                  : "border-white/5 bg-white/[0.01]"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/30 tracking-[0.2em]">LOT REDUCTION</span>
                  <span className={`text-xs font-bold ${bot.lot_reduction_active ? "text-neon-amber" : "text-white/30"}`}>
                    {bot.lot_reduction_active ? "ACTIVE" : "NORMAL"}
                  </span>
                </div>
              </div>

              {/* Daily loss */}
              <div className={`border p-3 ${
                (bot.daily_loss_pct ?? 0) > 2.5
                  ? "border-neon-red/20 bg-neon-red/5"
                  : "border-white/5 bg-white/[0.01]"
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] text-white/30 tracking-[0.2em]">DAILY LOSS</span>
                  <span className={`text-xs font-bold ${
                    (bot.daily_loss_pct ?? 0) > 2.5 ? "text-neon-red" : "text-white/50"
                  }`}>{fmt(bot.daily_loss_pct)}%</span>
                </div>
                <div className="h-1 bg-white/5 relative overflow-hidden">
                  <div
                    className={`bar-fill h-full transition-all duration-700 ${
                      (bot.daily_loss_pct ?? 0) > 2.5 ? "bg-neon-red" : "bg-neon-green/40"
                    }`}
                    style={{ "--bar-w": `${Math.min(((bot.daily_loss_pct ?? 0) / 3) * 100, 100)}%` } as React.CSSProperties}
                  />
                </div>
                <div className="flex justify-between text-[8px] text-white/15 mt-0.5">
                  <span>0%</span><span>CAP: 3%</span>
                </div>
              </div>

              {/* DD from HWM visual */}
              <div className="border border-white/5 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] text-white/30 tracking-[0.2em]">DRAWDOWN</span>
                  <span className={`text-xs font-bold ${ddColor(bot.dd_from_hwm_pct)}`}>
                    {fmt(bot.dd_from_hwm_pct)}%
                  </span>
                </div>
                <div className="h-1 bg-white/5 relative overflow-hidden">
                  <div
                    className={`bar-fill h-full transition-all duration-700 ${
                      (bot.dd_from_hwm_pct ?? 0) > 10 ? "bg-neon-red"
                      : (bot.dd_from_hwm_pct ?? 0) > 5 ? "bg-neon-amber"
                      : "bg-neon-cyan/40"
                    }`}
                    style={{ "--bar-w": `${Math.min(((bot.dd_from_hwm_pct ?? 0) / 30) * 100, 100)}%` } as React.CSSProperties}
                  />
                </div>
                <div className="flex justify-between text-[8px] text-white/15 mt-0.5">
                  <span>0%</span><span>MAX: 30%</span>
                </div>
              </div>

              {/* Phase badge */}
              {bot.phase && (
                <div className="border border-neon-cyan/10 bg-neon-cyan/5 p-3 text-center">
                  <p className="text-[8px] text-white/20 mb-0.5">MARKET PHASE</p>
                  <p className="text-sm font-bold text-neon-cyan tracking-widest">{bot.phase}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── OPEN POSITIONS (MT5 live) ─────────────────────────────────── */}
        <div className="bracket-corners border border-white/5 bg-dark-card/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-purple/20 to-transparent" />
          <div className="px-5 pt-4 pb-3 border-b border-white/5 flex items-center justify-between">
            <p className="text-[9px] text-white/25 tracking-[0.35em] uppercase">
              POS://OPEN_POSITIONS // {bpos.length} basket · {(mt5.allPositions ?? []).length} total
            </p>
            {mt5.fetchedAt && (
              <p className="text-[8px] text-white/15">synced {timeAgo(mt5.fetchedAt)}</p>
            )}
          </div>

          {bpos.length === 0 ? (
            <p className="px-5 py-6 text-center text-[10px] text-white/15 tracking-widest">
              {mt5Error ? "MT5 UNAVAILABLE — RECONNECTING..." : "NO BASKET POSITIONS OPEN"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/5">
                    {["SYMBOL", "SIDE", "VOLUME", "OPEN PRICE", "CURRENT", "SWAP", "P&L", "OPENED"].map(h => (
                      <th key={h} className="text-left px-5 py-2.5 text-[9px] text-white/20 tracking-[0.2em] font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bpos.map(p => (
                    <tr key={p.id} className="border-b border-white/[0.03] hover:bg-neon-cyan/[0.02] transition-colors">
                      <td className="px-5 py-2.5 text-white/80 font-bold">{p.symbol}</td>
                      <td className={`px-5 py-2.5 font-bold ${p.type === "buy" ? "text-neon-green" : "text-neon-red"}`}>
                        {p.type.toUpperCase()}
                      </td>
                      <td className="px-5 py-2.5 text-white/50">{fmt(p.volume, 4)}</td>
                      <td className="px-5 py-2.5 text-white/40">{fmt(p.openPrice, 5)}</td>
                      <td className="px-5 py-2.5 text-white/60">{fmt(p.currentPrice, 5)}</td>
                      <td className={`px-5 py-2.5 ${p.swap < 0 ? "text-neon-red/60" : "text-white/30"}`}>
                        {fmt(p.swap)}
                      </td>
                      <td className={`px-5 py-2.5 font-bold ${p.profit >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                        {p.profit >= 0 ? "+" : ""}${fmt(p.profit)}
                      </td>
                      <td className="px-5 py-2.5 text-white/25 text-[9px]">
                        {timeAgo(p.openTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── TRADE HISTORY ─────────────────────────────────────────────── */}
        <div className="bracket-corners border border-white/5 bg-dark-card/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/15 to-transparent" />
          <div className="px-5 pt-4 pb-3 border-b border-white/5">
            <p className="text-[9px] text-white/25 tracking-[0.35em] uppercase">
              HIST://TRADE_LOG // {trades.length} records
            </p>
          </div>
          {trades.length === 0 ? (
            <p className="px-5 py-6 text-center text-[10px] text-white/15 tracking-widest">
              NO TRADE HISTORY — AWAITING EA DATA
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/5">
                    {["TIME", "SYMBOL", "SIDE", "LOTS", "ENTRY", "EXIT", "P&L", "STATUS"].map(h => (
                      <th key={h} className="text-left px-5 py-2 text-[9px] text-white/20 tracking-[0.2em] font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 15).map(t => (
                    <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors">
                      <td className="px-5 py-2 text-white/25 text-[9px]">{timeAgo(t.opened_at)}</td>
                      <td className="px-5 py-2 text-white/70 font-bold">{t.symbol}</td>
                      <td className={`px-5 py-2 font-bold ${t.side === "buy" ? "text-neon-green" : t.side === "sell" ? "text-neon-red" : "text-white/20"}`}>
                        {(t.side ?? "—").toUpperCase()}
                      </td>
                      <td className="px-5 py-2 text-white/40">{fmt(t.lots, 4)}</td>
                      <td className="px-5 py-2 text-white/40">{fmt(t.entry, 5)}</td>
                      <td className="px-5 py-2 text-white/40">{t.exit_price ? fmt(t.exit_price, 5) : "—"}</td>
                      <td className={`px-5 py-2 font-bold ${pnlColor(t.pnl)}`}>
                        {t.pnl !== undefined ? `${t.pnl >= 0 ? "+" : ""}$${fmt(t.pnl)}` : "—"}
                      </td>
                      <td className="px-5 py-2">
                        <span className={`text-[9px] tracking-[0.15em] font-bold ${
                          t.status === "open" ? "text-neon-cyan" : "text-white/20"
                        }`}>{t.status.toUpperCase()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── COMPOUND CALCULATOR ───────────────────────────────────────── */}
        <CompoundCalculator />

      </div>
    </div>
  );
}
