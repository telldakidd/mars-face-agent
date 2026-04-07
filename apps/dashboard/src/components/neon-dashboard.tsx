"use client";

import React, { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Stat {
  label: string;
  value: string;
  change: string;
  code: string;
}

interface Alert {
  title: string;
  detail: string;
  level: "warning" | "info" | "danger";
}

interface AllocationItem {
  name: string;
  value: number;
  color: string;
}

interface ConversationEntry {
  role: "user" | "agent";
  text: string;
}

interface NeonDashboardProps {
  stats?: Stat[];
  alerts?: Alert[];
  allocation?: AllocationItem[];
  recentConversation?: ConversationEntry[];
}

function generateCurveData() {
  const data = [];
  for (let i = 0; i < 30; i++) {
    data.push({
      day: `D${i + 1}`,
      modelA: 50 + 30 * Math.sin((i / 30) * Math.PI * 2) + Math.random() * 8,
      modelB: 55 + 25 * Math.sin((i / 30) * Math.PI * 2 + 1) + Math.random() * 6,
    });
  }
  return data;
}

const defaultStats: Stat[] = [
  { label: "REVENUE", value: "$1.2M", change: "+12%", code: "REV.01" },
  { label: "PROFIT", value: "$420K", change: "+6%", code: "PNL.02" },
  { label: "EXPENSES", value: "$780K", change: "-3%", code: "EXP.03" },
  { label: "RUNWAY", value: "14 mo", change: "stable", code: "RUN.04" },
];

const defaultAlerts: Alert[] = [
  { title: "LIQUIDITY DIP", detail: "Account #3 — -4.2% deviation", level: "warning" },
  { title: "DEPOSIT DETECTED", detail: "$85K across VIP tier nodes", level: "info" },
  { title: "AUTO-RISK HALT", detail: "Bot paused — max drawdown breach", level: "danger" },
];

const defaultAllocation: AllocationItem[] = [
  { name: "Growth", value: 45, color: "#00ffc8" },
  { name: "Income", value: 30, color: "#b833ff" },
  { name: "Liquidity", value: 25, color: "#ff003c" },
];

const defaultConversation: ConversationEntry[] = [
  { role: "user", text: "Where are we against our target for Q2?" },
  { role: "agent", text: "We're at 74% of target. Growth accounts pacing +3.2% week over week." },
];

const curveData = generateCurveData();

const levelStyles: Record<string, { border: string; badge: string; glow: string }> = {
  warning: {
    border: "border-neon-amber/30",
    badge: "text-neon-amber bg-neon-amber/10 border-neon-amber/40",
    glow: "",
  },
  info: {
    border: "border-neon-cyan/30",
    badge: "text-neon-cyan bg-neon-cyan/10 border-neon-cyan/40",
    glow: "",
  },
  danger: {
    border: "border-neon-red/30",
    badge: "text-neon-red bg-neon-red/10 border-neon-red/40",
    glow: "card-danger-glow",
  },
};

export default function NeonDashboard({
  stats = defaultStats,
  alerts = defaultAlerts,
  allocation = defaultAllocation,
  recentConversation = defaultConversation,
}: NeonDashboardProps) {
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  async function sendBroadcast() {
    if (!broadcastMsg.trim()) return;
    setBroadcastStatus("TRANSMITTING...");
    try {
      const res = await fetch(`${API}/api/phone/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: broadcastMsg, type: "alert" }),
      });
      const data = await res.json();
      setBroadcastStatus(`TRANSMITTED // ${data.sent ?? 30} NODES`);
      setBroadcastMsg("");
    } catch {
      setBroadcastStatus("TRANSMISSION FAILED");
    }
    setTimeout(() => setBroadcastStatus(null), 4000);
  }

  return (
    <div className="min-h-screen px-8 py-10 text-white relative">
      {/* Header */}
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px flex-1 bg-gradient-to-r from-neon-cyan/30 to-transparent" />
          <span className="text-[10px] text-neon-cyan/30 font-mono tracking-widest">
            SYS://DASHBOARD
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-neon-cyan/30 to-transparent" />
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mt-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-neon-cyan/40 font-mono">
              mars autonomous management
            </p>
            <h1
              className="text-3xl font-bold tracking-wider text-white mt-1 glitch-text"
              data-text="COMMAND CENTER"
            >
              COMMAND CENTER
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-white/20 font-mono">
              {new Date().toISOString().split("T")[0]}
            </span>
            <button className="rounded border border-neon-cyan/20 bg-neon-cyan/5 px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-neon-cyan/70 transition hover:border-neon-cyan/40 hover:text-neon-cyan hover:shadow-glow-cyan">
              Generate Report
            </button>
          </div>
        </div>
      </header>

      {/* Stats Row */}
      <section className="grid gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const isNegative = stat.change.startsWith("-");
          const changeColor = isNegative ? "text-neon-red" : "text-neon-cyan";
          return (
            <div
              key={stat.label}
              className="bracket-corners rounded-none border border-white/5 bg-dark-card/80 p-5 card-glow relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/20 via-neon-cyan/5 to-transparent" />
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
                  {stat.label}
                </p>
                <span className="text-[9px] text-white/10 font-mono">{stat.code}</span>
              </div>
              <p className="text-2xl font-bold font-mono tracking-tight text-white">
                {stat.value}
              </p>
              <p className={`text-xs font-mono mt-1 ${changeColor}`}>
                {stat.change}
              </p>
            </div>
          );
        })}
      </section>

      {/* Charts Row */}
      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Confidence Curve */}
        <div className="lg:col-span-2 rounded-none border border-white/5 bg-dark-card/60 p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/30 via-transparent to-neon-purple/30" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
                risk.performance
              </p>
              <h2 className="text-lg font-bold tracking-wider mt-1">CONFIDENCE CURVE</h2>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-white/40 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-neon-cyan" /> MODEL_A
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-neon-purple" /> MODEL_B
              </span>
            </div>
          </div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curveData}>
                <defs>
                  <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ffc8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00ffc8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b833ff" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#b833ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "rgba(0,255,200,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "rgba(0,255,200,0.1)" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0a0c14",
                    border: "1px solid rgba(0,255,200,0.2)",
                    borderRadius: "0",
                    color: "#00ffc8",
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="modelA"
                  stroke="#00ffc8"
                  strokeWidth={1.5}
                  fill="url(#gradCyan)"
                />
                <Area
                  type="monotone"
                  dataKey="modelB"
                  stroke="#b833ff"
                  strokeWidth={1.5}
                  fill="url(#gradPurple)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Allocation Donut */}
        <div className="rounded-none border border-white/5 bg-dark-card/60 p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-purple/30 to-transparent" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
            allocation.mix
          </p>
          <h2 className="mb-6 text-lg font-bold tracking-wider mt-1">ASSET SPLIT</h2>
          <div className="flex items-center justify-center">
            <div className="h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {allocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#0a0c14",
                      border: "1px solid rgba(0,255,200,0.2)",
                      borderRadius: "0",
                      color: "#00ffc8",
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-xs font-mono">
            {allocation.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-white/50">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name.toUpperCase()}
                </span>
                <span className="text-white/70">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Activity + Agent Row */}
      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Alerts */}
        <div className="lg:col-span-2 rounded-none border border-white/5 bg-dark-card/60 p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-amber/30 to-transparent" />
          <div className="flex items-center gap-2 mb-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
              agent.activity
            </p>
            <span className="text-[9px] text-neon-amber/40 font-mono">
              // {alerts.length} EVENTS
            </span>
          </div>
          <div className="space-y-3 text-sm">
            {alerts.map((alert, idx) => {
              const style = levelStyles[alert.level] ?? levelStyles.info;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between border bg-black/30 px-4 py-3 ${style.border} ${style.glow}`}
                >
                  <div>
                    <p className="font-bold text-xs font-mono tracking-wider text-white/90">
                      {alert.title}
                    </p>
                    <p className="text-[11px] text-white/40 font-mono mt-0.5">
                      {alert.detail}
                    </p>
                  </div>
                  <span
                    className={`border px-3 py-1 text-[9px] uppercase tracking-[0.2em] font-mono font-bold ${style.badge}`}
                  >
                    {alert.level}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Client Agent */}
        <div className="rounded-none border border-white/5 bg-dark-card/60 p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/30 to-transparent" />
          <div className="flex items-center gap-2 mb-5">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
              agent.interface
            </p>
            <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan status-pulse" />
          </div>
          <div className="flex flex-col gap-3 text-xs font-mono">
            {recentConversation.map((entry, idx) => (
              <div
                key={idx}
                className={`border p-4 ${
                  entry.role === "user"
                    ? "border-white/5 bg-white/[0.02]"
                    : "border-neon-cyan/10 bg-neon-cyan/[0.02]"
                }`}
              >
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/25 mb-2">
                  {entry.role === "user" ? "> INPUT" : "< OUTPUT"}
                </p>
                <p className={`text-[12px] leading-relaxed ${
                  entry.role === "agent" ? "text-neon-cyan/70" : "text-white/60"
                }`}>
                  {entry.text}
                </p>
              </div>
            ))}
            <a
              href="mars://chat"
              className="mt-2 block border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-neon-cyan/80 transition hover:bg-neon-cyan/10 hover:text-neon-cyan hover:shadow-glow-cyan"
            >
              Open Agent Interface
            </a>
          </div>
        </div>
      </section>

      {/* Broadcast */}
      <section className="mt-8 rounded-none border border-white/5 bg-dark-card/60 p-6 relative overflow-hidden warning-stripes">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-amber/30 via-transparent to-neon-red/30" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
              fleet.broadcast
            </p>
            <h2 className="text-lg font-bold tracking-wider mt-1 cursor-blink">
              PUSH TO ALL NODES
            </h2>
          </div>
          <span className="text-[10px] text-neon-amber/30 font-mono">
            30 TARGETS
          </span>
        </div>
        <div className="flex gap-3">
          <input
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            placeholder="// enter broadcast message..."
            className="flex-1 border border-white/10 bg-black/40 px-4 py-2.5 text-xs font-mono text-white placeholder-white/20 outline-none focus:border-neon-cyan/30 focus:shadow-glow-cyan transition"
            onKeyDown={(e) => e.key === "Enter" && sendBroadcast()}
          />
          <button
            onClick={sendBroadcast}
            className="border border-neon-red/30 bg-neon-red/10 px-6 py-2.5 text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-neon-red transition hover:bg-neon-red/20 hover:shadow-glow-red"
          >
            Broadcast
          </button>
        </div>
        {broadcastStatus && (
          <p className="mt-2 text-xs font-mono text-neon-cyan/70">
            {`> ${broadcastStatus}`}
          </p>
        )}
      </section>
    </div>
  );
}
