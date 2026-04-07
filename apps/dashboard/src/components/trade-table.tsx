"use client";

import React from "react";

interface Trade {
  platform: string;
  symbol: string;
  side: string;
  qty: number;
  price: number;
  pnl: number;
  strategy: string;
  executed_at: string;
}

interface TradeTableProps {
  trades: Trade[];
}

const platformBadge: Record<string, string> = {
  MT5: "text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5",
  Polymarket: "text-neon-purple border-neon-purple/30 bg-neon-purple/5",
  TradingView: "text-neon-pink border-neon-pink/30 bg-neon-pink/5",
};

export default function TradeTable({ trades }: TradeTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs font-mono">
        <thead>
          <tr className="border-b border-white/5 text-[9px] uppercase tracking-[0.3em] text-white/20">
            <th className="px-4 py-3">Platform</th>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Side</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Price</th>
            <th className="px-4 py-3 text-right">PnL</th>
            <th className="px-4 py-3">Strategy</th>
            <th className="px-4 py-3">Time</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, idx) => {
            const pnlColor =
              trade.pnl >= 0 ? "text-neon-green" : "text-neon-red";
            const pnlPrefix = trade.pnl >= 0 ? "+" : "";
            const badge =
              platformBadge[trade.platform] ??
              "text-white/40 border-white/10 bg-white/[0.02]";

            return (
              <tr
                key={idx}
                className="border-b border-white/[0.03] transition hover:bg-neon-cyan/[0.02]"
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-block border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] ${badge}`}
                  >
                    {trade.platform}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold tracking-wider text-white/80">
                  {trade.symbol}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      trade.side === "buy"
                        ? "text-neon-green"
                        : "text-neon-red"
                    }`}
                  >
                    {trade.side}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-white/50">
                  {trade.qty}
                </td>
                <td className="px-4 py-3 text-right text-white/50">
                  ${trade.price.toLocaleString()}
                </td>
                <td
                  className={`px-4 py-3 text-right font-bold ${pnlColor}`}
                >
                  {pnlPrefix}${Math.abs(trade.pnl).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-white/30">{trade.strategy}</td>
                <td className="px-4 py-3 text-white/20">
                  {new Date(trade.executed_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            );
          })}
          {trades.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-8 text-center text-[10px] text-white/15 tracking-wider"
              >
                NO TRADES RECORDED
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
