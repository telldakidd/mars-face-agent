import React from "react";

/**
 * NeonFinDash — drop this into your Next.js/Tailwind project.
 * Example usage: <NeonFinDash />
 */
export default function NeonFinDash() {
  const stats = [
    { label: "Revenue", value: "$1.2M", change: "+12%" },
    { label: "Profit", value: "$420K", change: "+6%" },
    { label: "Expenses", value: "$780K", change: "-3%" },
    { label: "Runway", value: "14 mo", change: "stable" },
  ];

  const alerts = [
    { title: "Liquidity dip", detail: "Account #3 -4.2%", level: "warning" },
    { title: "New deposits", detail: "$85K across VIP tier", level: "info" },
    { title: "Auto-risk pause", detail: "Bot paused after max drawdown", level: "danger" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05060a] via-[#070b1a] to-[#03030a] px-6 py-10 text-white">
      <header className="mb-10 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-white/60">Mars Management</p>
          <h1 className="text-3xl font-semibold">Neon Portfolio Command</h1>
        </div>
        <button className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:border-white/60 hover:text-white">
          Generate Report
        </button>
      </header>

      <section className="grid gap-5 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_25px_rgba(0,255,255,0.06)]">
            <p className="text-xs uppercase tracking-wide text-white/60">{stat.label}</p>
            <p className="mt-3 text-2xl font-semibold">{stat.value}</p>
            <p className="text-sm text-emerald-300">{stat.change}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#111c45]/70 to-[#091022]/80 p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-white/60">Risk Performance</p>
              <h2 className="text-2xl font-semibold">Confidence Curve</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-cyan-300" /> Model A
              <span className="h-2 w-2 rounded-full bg-purple-300" /> Model B
            </div>
          </div>
          <div className="mt-6 h-64 rounded-2xl bg-black/20" />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-wide text-white/60">Account Mix</p>
          <h2 className="mb-6 text-2xl font-semibold">Allocation</h2>
          <div className="flex items-center justify-center">
            <div className="relative h-40 w-40">
              <div className="absolute inset-0 rounded-full border-8 border-cyan-400/70" />
              <div className="absolute inset-3 rounded-full border-8 border-purple-400/70" />
              <div className="absolute inset-6 rounded-full border-8 border-pink-400/70" />
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-white/80">
            <div className="flex items-center justify-between">
              <span>Growth</span>
              <span>45%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Income</span>
              <span>30%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Liquidity</span>
              <span>25%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
          <p className="text-sm uppercase tracking-wide text-white/60">Agent Activity</p>
          <div className="mt-4 space-y-4 text-sm text-white/80">
            {alerts.map((alert, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="font-semibold">{alert.title}</p>
                  <p className="text-white/60">{alert.detail}</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide">{alert.level}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#1d1f4a] to-[#080b1b] p-6">
          <p className="text-sm uppercase tracking-wide text-white/60">Client Agent</p>
          <div className="mt-5 flex flex-col gap-3 text-sm text-white/80">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Latest prompt</p>
              <p className="mt-2 text-white">“Where are we against our target for Q2?”</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Agent response</p>
              <p className="mt-2 text-white">“We’re at 74% of target. Growth accounts pacing +3.2% week over week.”</p>
            </div>
            <button className="mt-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#05060a] hover:bg-cyan-300">
              Open Face-to-Face Agent
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
