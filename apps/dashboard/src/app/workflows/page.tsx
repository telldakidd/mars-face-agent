"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Workflow = {
  id: string;
  title: string;
  description?: string;
  platform: "make" | "n8n";
  guide_title?: string;
  guide_steps: { step: number; text: string }[];
  tags: string[];
  version: string;
  created_at: string;
};

type DeviceWithStats = {
  id: string;
  name: string;
  email: string;
  subscription_tier: string;
  device: { device_id: string; last_seen: string; is_active: boolean } | null;
  workflowStats: { total: number; pending: number; complete: number };
};

const PLATFORM_STYLE = {
  n8n: {
    badge: "text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5",
    glow: "border-neon-cyan/10",
    top: "from-neon-cyan/20 to-transparent",
  },
  make: {
    badge: "text-neon-purple border-neon-purple/30 bg-neon-purple/5",
    glow: "border-neon-purple/10",
    top: "from-neon-purple/20 to-transparent",
  },
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [devices, setDevices] = useState<DeviceWithStats[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "n8n" | "make">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<Workflow | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(
    new Set()
  );

  // Create form
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [platform, setPlatform] = useState<"make" | "n8n">("n8n");
  const [guideSteps, setGuideSteps] = useState<string[]>([""]);

  const load = useCallback(async () => {
    const [wRes, dRes] = await Promise.all([
      fetch(`${API}/api/workflows`),
      fetch(`${API}/api/workflows/admin/devices`),
    ]);
    setWorkflows(await wRes.json());
    setDevices(await dRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    activeTab === "all"
      ? workflows
      : workflows.filter((w) => w.platform === activeTab);

  const handleCreate = async () => {
    if (!title.trim()) return;
    await fetch(`${API}/api/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: desc.trim() || undefined,
        platform,
        guideSteps: guideSteps
          .filter((s) => s.trim())
          .map((text, i) => ({ step: i + 1, text: text.trim() })),
      }),
    });
    setShowCreate(false);
    setTitle("");
    setDesc("");
    setGuideSteps([""]);
    load();
  };

  const handleAssign = async () => {
    if (!showAssign || selectedDevices.size === 0) return;
    await fetch(`${API}/api/workflows/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowId: showAssign.id,
        clientIds: Array.from(selectedDevices),
      }),
    });
    setShowAssign(null);
    setSelectedDevices(new Set());
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("CONFIRM WORKFLOW DELETION?")) return;
    await fetch(`${API}/api/workflows/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="min-h-screen px-8 py-10 text-white">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px flex-1 bg-gradient-to-r from-neon-green/30 to-transparent" />
          <span className="text-[10px] text-neon-green/30 font-mono tracking-widest">
            SYS://WORKFLOWS
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-neon-green/30 to-transparent" />
        </div>
        <div className="flex items-center justify-between mt-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-neon-green/40 font-mono">
              automation distribution
            </p>
            <h1 className="text-3xl font-bold tracking-wider mt-1">
              WORKFLOWS
            </h1>
            <p className="mt-1 text-[10px] text-white/20 font-mono tracking-wider">
              Manage and distribute Make & n8n workflows to customer nodes
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="border border-neon-cyan/20 bg-neon-cyan/5 px-5 py-2.5 text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-neon-cyan transition hover:bg-neon-cyan/10 hover:shadow-glow-cyan"
          >
            + NEW WORKFLOW
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-0 border border-white/5 w-fit">
        {(["all", "n8n", "make"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] transition border-r border-white/5 last:border-r-0 ${
              activeTab === tab
                ? "bg-white/5 text-white"
                : "text-white/25 hover:text-white/50 hover:bg-white/[0.02]"
            }`}
          >
            {tab === "all" ? "ALL" : tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <StatCard
          label="TOTAL"
          value={workflows.length}
          color="cyan"
        />
        <StatCard
          label="N8N"
          value={workflows.filter((w) => w.platform === "n8n").length}
          color="cyan"
        />
        <StatCard
          label="MAKE"
          value={workflows.filter((w) => w.platform === "make").length}
          color="purple"
        />
        <StatCard label="NODES" value={devices.length} color="green" />
      </div>

      {/* Workflow Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filtered.map((w) => {
          const ps = PLATFORM_STYLE[w.platform];
          return (
            <div
              key={w.id}
              className={`bracket-corners border bg-dark-card/60 p-5 transition hover:bg-dark-card/80 relative overflow-hidden ${ps.glow}`}
            >
              <div
                className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${ps.top}`}
              />
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={`border px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.2em] ${ps.badge}`}
                >
                  {w.platform}
                </span>
                <span className="text-[9px] text-white/15 font-mono">
                  v{w.version}
                </span>
              </div>
              <h3 className="text-sm font-bold font-mono tracking-wider text-white/90">
                {w.title.toUpperCase()}
              </h3>
              {w.description && (
                <p className="mt-1 text-[11px] text-white/30 font-mono line-clamp-2">
                  {w.description}
                </p>
              )}
              {w.guide_steps.length > 0 && (
                <p className="mt-2 text-[10px] text-neon-cyan/40 font-mono">
                  {w.guide_steps.length}-STEP SETUP GUIDE
                </p>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssign(w);
                    setSelectedDevices(new Set());
                  }}
                  className="border border-neon-cyan/20 bg-neon-cyan/5 px-4 py-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-neon-cyan transition hover:bg-neon-cyan/10"
                >
                  Send to Nodes
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(w.id)}
                  className="border border-neon-red/15 bg-neon-red/[0.03] px-4 py-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-neon-red/50 transition hover:bg-neon-red/10 hover:text-neon-red"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Device Overview */}
      <div className="mt-12 mb-4 flex items-center gap-2">
        <h2 className="text-lg font-bold tracking-wider">NODE STATUS</h2>
        <span className="text-[9px] text-white/15 font-mono">
          // {devices.length} REGISTERED
        </span>
      </div>
      <div className="overflow-x-auto border border-white/5">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-white/5 bg-dark-card/80 text-[9px] uppercase tracking-[0.3em] text-white/20">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-left">Workflows</th>
              <th className="px-4 py-3 text-left">Pending</th>
              <th className="px-4 py-3 text-left">Complete</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr
                key={d.id}
                className="border-b border-white/[0.03] hover:bg-neon-cyan/[0.02] transition"
              >
                <td className="px-4 py-3 font-bold tracking-wider text-white/80">
                  {d.name.toUpperCase()}
                </td>
                <td className="px-4 py-3 text-white/25">{d.email}</td>
                <td className="px-4 py-3">
                  <span className="border border-white/10 bg-white/[0.02] px-2 py-0.5 text-[9px] text-white/40 uppercase tracking-wider">
                    {d.subscription_tier}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/50">
                  {d.workflowStats.total}
                </td>
                <td className="px-4 py-3 text-neon-amber">
                  {d.workflowStats.pending}
                </td>
                <td className="px-4 py-3 text-neon-green">
                  {d.workflowStats.complete}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block h-2 w-2 ${
                      d.device?.is_active
                        ? "bg-neon-cyan status-pulse"
                        : "bg-white/10"
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-white/10 bg-void-light p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/40 via-transparent to-neon-purple/40" />
            <div className="scan-line" />

            <h2 className="mb-1 text-lg font-bold tracking-wider">
              NEW WORKFLOW
            </h2>
            <p className="mb-5 text-[10px] text-white/20 font-mono tracking-wider">
              // DEFINE AUTOMATION
            </p>

            <label className="mb-1 block text-[9px] font-mono uppercase tracking-[0.3em] text-white/25">
              Platform
            </label>
            <div className="mb-4 flex gap-0 border border-white/5 w-fit">
              {(["n8n", "make"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`px-5 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] transition border-r border-white/5 last:border-r-0 ${
                    platform === p
                      ? PLATFORM_STYLE[p].badge
                      : "text-white/25 hover:text-white/40"
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>

            <label className="mb-1 block text-[9px] font-mono uppercase tracking-[0.3em] text-white/25">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-4 w-full border border-white/10 bg-black/40 px-4 py-2.5 text-xs font-mono text-white placeholder:text-white/15 focus:border-neon-cyan/30 focus:outline-none transition"
              placeholder="e.g. Lead Capture Automation"
            />

            <label className="mb-1 block text-[9px] font-mono uppercase tracking-[0.3em] text-white/25">
              Description
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              className="mb-4 w-full border border-white/10 bg-black/40 px-4 py-2.5 text-xs font-mono text-white placeholder:text-white/15 focus:border-neon-cyan/30 focus:outline-none resize-none transition"
              placeholder="What does this workflow do?"
            />

            <label className="mb-1 block text-[9px] font-mono uppercase tracking-[0.3em] text-white/25">
              Setup Guide Steps
            </label>
            {guideSteps.map((step, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <span className="flex items-center text-[10px] text-white/15 w-6 font-mono">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <input
                  value={step}
                  onChange={(e) => {
                    const next = [...guideSteps];
                    next[i] = e.target.value;
                    setGuideSteps(next);
                  }}
                  className="flex-1 border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white placeholder:text-white/15 focus:border-neon-cyan/30 focus:outline-none transition"
                  placeholder={`Step ${i + 1}...`}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setGuideSteps([...guideSteps, ""])}
              className="mb-5 text-[10px] font-mono text-neon-cyan/50 hover:text-neon-cyan tracking-wider"
            >
              + ADD STEP
            </button>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-[10px] font-mono text-white/30 hover:text-white/60 uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="border border-neon-cyan/30 bg-neon-cyan/10 px-5 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-neon-cyan hover:bg-neon-cyan/20 transition"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md border border-white/10 bg-void-light p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-green/40 to-transparent" />

            <h2 className="mb-1 text-lg font-bold tracking-wider">
              DISTRIBUTE
            </h2>
            <p className="mb-4 text-[10px] text-white/30 font-mono tracking-wider">
              {showAssign.title.toUpperCase()} //&nbsp;
              <span
                className={
                  showAssign.platform === "n8n"
                    ? "text-neon-cyan"
                    : "text-neon-purple"
                }
              >
                {showAssign.platform.toUpperCase()}
              </span>
            </p>

            <button
              type="button"
              onClick={() =>
                setSelectedDevices(new Set(devices.map((d) => d.id)))
              }
              className="mb-3 text-[10px] font-mono text-neon-cyan/50 hover:text-neon-cyan tracking-wider"
            >
              SELECT ALL NODES
            </button>

            <div className="max-h-60 overflow-y-auto border border-white/5">
              {devices.map((d) => (
                <label
                  key={d.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-white/[0.03] px-4 py-3 hover:bg-neon-cyan/[0.02] transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedDevices.has(d.id)}
                    onChange={() => {
                      const next = new Set(selectedDevices);
                      next.has(d.id) ? next.delete(d.id) : next.add(d.id);
                      setSelectedDevices(next);
                    }}
                    className="accent-neon-cyan"
                  />
                  <div>
                    <p className="text-xs font-mono font-bold tracking-wider text-white/80">
                      {d.name.toUpperCase()}
                    </p>
                    <p className="text-[10px] font-mono text-white/20">
                      {d.email}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAssign(null)}
                className="px-4 py-2 text-[10px] font-mono text-white/30 hover:text-white/60 uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                className="border border-neon-green/30 bg-neon-green/10 px-5 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-neon-green hover:bg-neon-green/20 transition"
              >
                TRANSMIT ({selectedDevices.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "cyan" | "purple" | "green";
}) {
  const styles = {
    cyan: "border-neon-cyan/10 text-neon-cyan",
    purple: "border-neon-purple/10 text-neon-purple",
    green: "border-neon-green/10 text-neon-green",
  };
  const tops = {
    cyan: "from-neon-cyan/20",
    purple: "from-neon-purple/20",
    green: "from-neon-green/20",
  };
  return (
    <div
      className={`bracket-corners border bg-dark-card/60 p-4 relative overflow-hidden ${styles[color]}`}
    >
      <div
        className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${tops[color]} to-transparent`}
      />
      <p className="text-2xl font-bold font-mono">{value}</p>
      <p className="mt-1 text-[9px] text-white/20 font-mono uppercase tracking-[0.3em]">
        {label}
      </p>
    </div>
  );
}
