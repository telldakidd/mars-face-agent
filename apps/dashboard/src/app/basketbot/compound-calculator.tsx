"use client";

import { useState, useEffect, useRef } from "react";

interface Row {
  period: number;
  gain: number;
  balance: number;
}

function buildRows(start: number, pct: number, n: number): Row[] {
  let balance = start;
  return Array.from({ length: n }, (_, i) => {
    const gain = balance * (pct / 100);
    balance += gain;
    return { period: i + 1, gain, balance };
  });
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SparklineCanvas({ rows }: { rows: Row[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rows.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const values = rows.map((r) => r.balance);
    const min = values[0] * 0.98;
    const max = values[values.length - 1] * 1.02;
    const rangeY = max - min || 1;

    const toX = (i: number) => (i / (rows.length - 1)) * (W - 20) + 10;
    const toY = (v: number) => H - 20 - ((v - min) / rangeY) * (H - 30);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(0,255,255,0.15)");
    grad.addColorStop(1, "rgba(0,255,255,0.01)");

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(toX(i), toY(values[i]));
    }
    ctx.lineTo(toX(values.length - 1), H);
    ctx.lineTo(toX(0), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(toX(i), toY(values[i]));
    }
    ctx.strokeStyle = "rgba(0,255,255,0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // End dot
    ctx.beginPath();
    ctx.arc(toX(values.length - 1), toY(values[values.length - 1]), 3, 0, Math.PI * 2);
    ctx.fillStyle = "#00ffff";
    ctx.fill();

    // X-axis labels (first + last)
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "9px JetBrains Mono, monospace";
    ctx.fillText("1", toX(0) - 2, H - 4);
    ctx.fillText(String(rows.length), toX(rows.length - 1) - 4, H - 4);
  }, [rows]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={180}
      className="w-full h-auto"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export default function CompoundCalculator() {
  const [start, setStart] = useState(10000);
  const [pct, setPct] = useState(8);
  const [periods, setPeriods] = useState(12);
  const [mode, setMode] = useState<"monthly" | "weekly">("monthly");

  const rows = buildRows(start, pct, periods);
  const finalBalance = rows[rows.length - 1]?.balance ?? start;
  const totalGain = finalBalance - start;
  const totalGainPct = (totalGain / start) * 100;

  return (
    <div className="border border-neon-amber/10 bg-dark-card/60 p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-amber/30 to-transparent" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-gradient-to-r from-neon-amber/20 to-transparent" />
        <span className="text-[10px] text-neon-amber/40 font-mono tracking-widest">
          SYS://COMPOUND.CALC
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-neon-amber/20 to-transparent" />
      </div>

      {/* Inputs */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] text-white/30 font-mono uppercase tracking-[0.2em]">
            Starting Balance ($)
          </label>
          <input
            type="number"
            value={start}
            min={100}
            onChange={(e) => setStart(Math.max(100, Number(e.target.value)))}
            className="w-36 border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white placeholder-white/20 outline-none focus:border-neon-amber/30 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] text-white/30 font-mono uppercase tracking-[0.2em]">
            Return % / Period
          </label>
          <input
            type="number"
            value={pct}
            min={0.1}
            step={0.5}
            onChange={(e) => setPct(Math.max(0.1, Number(e.target.value)))}
            className="w-28 border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white outline-none focus:border-neon-amber/30 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] text-white/30 font-mono uppercase tracking-[0.2em]">
            Periods
          </label>
          <input
            type="number"
            value={periods}
            min={1}
            max={120}
            onChange={(e) => setPeriods(Math.min(120, Math.max(1, Number(e.target.value))))}
            className="w-20 border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white outline-none focus:border-neon-amber/30 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] text-white/30 font-mono uppercase tracking-[0.2em]">
            Period Type
          </label>
          <div className="flex">
            {(["monthly", "weekly"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-2 text-[10px] font-mono uppercase tracking-[0.15em] transition border ${
                  mode === m
                    ? "border-neon-amber/40 bg-neon-amber/10 text-neon-amber"
                    : "border-white/10 bg-transparent text-white/30 hover:text-white/50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex gap-6 mb-6 border-t border-white/5 pt-4">
        <div>
          <p className="text-[9px] text-white/25 font-mono uppercase tracking-[0.2em] mb-0.5">Final Balance</p>
          <p className="text-lg font-bold text-neon-cyan font-mono">${fmt(finalBalance)}</p>
        </div>
        <div>
          <p className="text-[9px] text-white/25 font-mono uppercase tracking-[0.2em] mb-0.5">Total Gain</p>
          <p className="text-lg font-bold text-neon-green font-mono">+${fmt(totalGain)}</p>
        </div>
        <div>
          <p className="text-[9px] text-white/25 font-mono uppercase tracking-[0.2em] mb-0.5">Total Return</p>
          <p className="text-lg font-bold text-neon-green font-mono">+{fmt(totalGainPct)}%</p>
        </div>
      </div>

      {/* Table + Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Table */}
        <div className="overflow-auto max-h-64">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-1.5 text-[9px] text-white/25 uppercase tracking-[0.2em] pr-4">
                  {mode === "monthly" ? "Month" : "Week"}
                </th>
                <th className="text-right py-1.5 text-[9px] text-white/25 uppercase tracking-[0.2em] pr-4">
                  Gain
                </th>
                <th className="text-right py-1.5 text-[9px] text-white/25 uppercase tracking-[0.2em]">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.period}
                  className={`border-b border-white/[0.03] ${
                    i === rows.length - 1 ? "bg-neon-cyan/5" : ""
                  }`}
                >
                  <td className="py-1.5 pr-4 text-white/40">{row.period}</td>
                  <td className="py-1.5 pr-4 text-right text-neon-green">+{fmt(row.gain)}</td>
                  <td className="py-1.5 text-right text-white/80 font-bold">${fmt(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sparkline */}
        <div className="border border-white/5 bg-black/20 p-3 flex flex-col justify-between">
          <p className="text-[9px] text-white/20 font-mono tracking-widest mb-2">GROWTH_CURVE //</p>
          <SparklineCanvas rows={rows} />
        </div>
      </div>
    </div>
  );
}
