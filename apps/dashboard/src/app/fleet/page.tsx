"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Device {
  device_id: string;
  app_version: string | null;
  last_seen: string;
  is_active: boolean;
}

interface FleetClient {
  id: string;
  name: string;
  email: string;
  risk_tier: string;
  subscription_tier: string;
  voice_to_voice_enabled: boolean;
  trading_enabled: boolean;
  device: Device | null;
  online: boolean;
}

const TIER_BADGE: Record<string, string> = {
  basic: "text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5",
  pro: "text-neon-purple border-neon-purple/30 bg-neon-purple/5",
  elite: "text-neon-amber border-neon-amber/30 bg-neon-amber/5",
};

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function FleetPage() {
  const [fleet, setFleet] = useState<FleetClient[]>([]);
  const [broadcast, setBroadcast] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [wipingId, setWipingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadFleet = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/provision/fleet`);
      const data = await res.json();
      setFleet(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadFleet();
    const id = setInterval(loadFleet, 30_000);
    return () => clearInterval(id);
  }, [loadFleet]);

  const onlineCount = fleet.filter(
    (c) =>
      c.device?.is_active &&
      c.device.last_seen &&
      Date.now() - new Date(c.device.last_seen).getTime() < 5 * 60_000
  ).length;

  async function sendBroadcast() {
    if (!broadcast.trim()) return;
    setBroadcastStatus("TRANSMITTING...");
    try {
      const res = await fetch(`${API}/api/phone/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: broadcast, type: "alert" }),
      });
      const data = await res.json();
      setBroadcastStatus(`TRANSMITTED // ${data.sent ?? fleet.length} NODES`);
      setBroadcast("");
    } catch {
      setBroadcastStatus("TRANSMISSION FAILED");
    }
    setTimeout(() => setBroadcastStatus(null), 4000);
  }

  async function toggleTrading(clientId: string, current: boolean) {
    setTogglingId(clientId);
    try {
      await fetch(`${API}/api/clients/${clientId}/trading`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !current }),
      });
      loadFleet();
    } finally {
      setTogglingId(null);
    }
  }

  async function wipeDevice(clientId: string, name: string) {
    if (!confirm(`CONFIRM REMOTE WIPE: ${name}\nThis action cannot be undone.`))
      return;
    setWipingId(clientId);
    try {
      await fetch(`${API}/api/provision/wipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
    } finally {
      setWipingId(null);
      loadFleet();
    }
  }

  return (
    <div className="min-h-screen px-8 py-10 text-white">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px flex-1 bg-gradient-to-r from-neon-purple/30 to-transparent" />
          <span className="text-[10px] text-neon-purple/30 font-mono tracking-widest">
            SYS://FLEET
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-neon-purple/30 to-transparent" />
        </div>
        <div className="flex items-center justify-between mt-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-neon-purple/40 font-mono">
              device management
            </p>
            <h1 className="text-3xl font-bold tracking-wider mt-1 flex items-center gap-4">
              FLEET
              <span className="inline-flex items-center gap-1.5 border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-1 text-xs font-mono text-neon-cyan">
                <span className="h-1.5 w-1.5 bg-neon-cyan status-pulse" />
                {onlineCount} ONLINE
              </span>
            </h1>
          </div>
          <button
            type="button"
            onClick={loadFleet}
            className="border border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-white/40 transition hover:border-neon-cyan/20 hover:text-neon-cyan"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Broadcast Panel */}
      <section className="mb-8 border border-white/5 bg-dark-card/60 p-5 warning-stripes relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-amber/30 to-transparent" />
        <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
          fleet.broadcast // ALL NODES
        </p>
        <div className="flex gap-3">
          <input
            value={broadcast}
            onChange={(e) => setBroadcast(e.target.value)}
            placeholder="// enter broadcast payload..."
            className="flex-1 border border-white/10 bg-black/40 px-4 py-2.5 text-xs font-mono text-white placeholder-white/20 outline-none focus:border-neon-cyan/30 transition"
            onKeyDown={(e) => e.key === "Enter" && sendBroadcast()}
          />
          <button
            type="button"
            onClick={sendBroadcast}
            className="border border-neon-red/30 bg-neon-red/10 px-6 py-2 text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-neon-red transition hover:bg-neon-red/20 hover:shadow-glow-red"
          >
            Transmit
          </button>
        </div>
        {broadcastStatus && (
          <p className="mt-2 text-xs font-mono text-neon-cyan/70">
            {`> ${broadcastStatus}`}
          </p>
        )}
      </section>

      {/* Fleet Grid */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {fleet.length === 0 && (
          <p className="col-span-3 text-center text-white/20 py-16 font-mono text-xs tracking-wider">
            NO NODES DETECTED // PROVISION FIRST CLIENT
          </p>
        )}
        {fleet.map((client) => {
          const isOnline =
            client.device?.is_active === true &&
            !!client.device.last_seen &&
            Date.now() - new Date(client.device.last_seen).getTime() <
              5 * 60_000;

          return (
            <div
              key={client.id}
              className={`bracket-corners border bg-dark-card/60 p-5 relative overflow-hidden ${
                isOnline
                  ? "border-neon-cyan/10 card-glow"
                  : "border-white/5"
              }`}
            >
              <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${
                isOnline ? "from-neon-cyan/30 to-transparent" : "from-white/10 to-transparent"
              }`} />

              {/* Name + status */}
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-bold text-sm font-mono tracking-wider">
                    {client.name.toUpperCase()}
                  </p>
                  <p className="text-[10px] text-white/25 font-mono mt-0.5">
                    {client.email}
                  </p>
                </div>
                <span
                  className={`flex items-center gap-1.5 text-[10px] font-mono ${
                    isOnline ? "text-neon-cyan" : "text-white/20"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 ${
                      isOnline
                        ? "bg-neon-cyan status-pulse"
                        : "bg-white/15"
                    }`}
                  />
                  {isOnline ? "ONLINE" : "OFFLINE"}
                </span>
              </div>

              {/* Badges */}
              <div className="mb-3 flex flex-wrap gap-2">
                <span
                  className={`border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.2em] font-mono font-bold ${
                    TIER_BADGE[client.subscription_tier] ??
                    "text-white/40 bg-white/5 border-white/10"
                  }`}
                >
                  {client.subscription_tier}
                </span>
                {client.voice_to_voice_enabled && (
                  <span className="border border-neon-purple/30 bg-neon-purple/5 px-2.5 py-0.5 text-[9px] text-neon-purple uppercase tracking-[0.2em] font-mono font-bold">
                    Voice
                  </span>
                )}
              </div>

              {/* Device info */}
              {client.device ? (
                <div className="mb-4 text-[10px] text-white/25 space-y-0.5 font-mono">
                  <p>LAST_SEEN: {timeAgo(client.device.last_seen)} ago</p>
                  {client.device.app_version && (
                    <p>VERSION: v{client.device.app_version}</p>
                  )}
                </div>
              ) : (
                <p className="mb-4 text-[10px] text-white/15 font-mono">
                  NO DEVICE REGISTERED
                </p>
              )}

              {/* Trading toggle */}
              <button
                type="button"
                onClick={() => toggleTrading(client.id, client.trading_enabled)}
                disabled={togglingId === client.id}
                className={`mb-2 w-full border px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] transition disabled:opacity-30 ${
                  client.trading_enabled
                    ? "border-neon-amber/30 bg-neon-amber/5 text-neon-amber hover:bg-neon-amber/10"
                    : "border-white/10 bg-white/[0.02] text-white/30 hover:border-white/20 hover:text-white/50"
                }`}
              >
                {togglingId === client.id
                  ? "UPDATING..."
                  : client.trading_enabled
                    ? "TRADING: ACTIVE // DISABLE"
                    : "TRADING: HALTED // ENABLE"}
              </button>

              {/* Wipe button */}
              <button
                type="button"
                onClick={() => wipeDevice(client.id, client.name)}
                disabled={wipingId === client.id}
                className="w-full border border-neon-red/20 bg-neon-red/5 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-neon-red/60 transition hover:bg-neon-red/10 hover:text-neon-red hover:shadow-glow-red disabled:opacity-30"
              >
                {wipingId === client.id ? "WIPING..." : "REMOTE WIPE"}
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
