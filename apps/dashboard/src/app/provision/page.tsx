"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface QrResult {
  clientId: string;
  qrData: string;
  expiresAt: string;
  qrPayload: {
    name: string;
    email: string;
    tier: string;
    voiceToVoice: boolean;
  };
}

interface FleetClient {
  id: string;
  name: string;
  email: string;
  subscription_tier: string;
  voice_to_voice_enabled: boolean;
  trading_enabled: boolean;
  created_at: string;
}

const TIER_BADGE: Record<string, string> = {
  basic: "text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5",
  pro: "text-neon-purple border-neon-purple/30 bg-neon-purple/5",
  elite: "text-neon-amber border-neon-amber/30 bg-neon-amber/5",
};

export default function ProvisionPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<"basic" | "pro" | "elite">("basic");
  const [voiceToVoice, setVoiceToVoice] = useState(false);
  const [tradingEnabled, setTradingEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QrResult | null>(null);
  const [clients, setClients] = useState<FleetClient[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function loadClients() {
    try {
      const res = await fetch(`${API}/api/provision/fleet`);
      const data = await res.json();
      setClients(data);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/provision/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subscriptionTier: tier,
          voiceToVoice,
          tradingEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data);
      setName("");
      setEmail("");
      setTier("basic");
      setVoiceToVoice(false);
      setTradingEnabled(false);
      loadClients();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const qrImgUrl = result
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.qrData)}`
    : null;

  return (
    <div className="min-h-screen px-8 py-10 text-white">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px flex-1 bg-gradient-to-r from-neon-amber/30 to-transparent" />
          <span className="text-[10px] text-neon-amber/30 font-mono tracking-widest">
            SYS://PROVISION
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-neon-amber/30 to-transparent" />
        </div>
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.4em] text-neon-amber/40 font-mono">
            node onboarding
          </p>
          <h1 className="text-3xl font-bold tracking-wider mt-1">
            PROVISION CLIENT
          </h1>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Form */}
        <section className="border border-white/5 bg-dark-card/60 p-7 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/30 to-transparent" />
          <p className="mb-5 text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
            new.client // input
          </p>
          <form onSubmit={generate} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
                Identifier
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="JOHN_DOE"
                className="w-full border border-white/10 bg-black/40 px-4 py-3 text-xs font-mono text-white placeholder-white/15 outline-none focus:border-neon-cyan/30 transition"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="john@example.com"
                className="w-full border border-white/10 bg-black/40 px-4 py-3 text-xs font-mono text-white placeholder-white/15 outline-none focus:border-neon-cyan/30 transition"
              />
            </div>

            {/* Tier */}
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
                Subscription Tier
              </label>
              <div className="flex gap-2">
                {(["basic", "pro", "elite"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    className={`flex-1 border py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] transition ${
                      tier === t
                        ? TIER_BADGE[t]
                        : "border-white/10 text-white/25 hover:border-white/20 hover:text-white/40"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex gap-2 text-center text-[9px] text-white/15 font-mono">
                <span className="flex-1">$49/mo</span>
                <span className="flex-1">$99/mo</span>
                <span className="flex-1">$199/mo</span>
              </div>
            </div>

            {/* Voice toggle */}
            <div className="flex items-center justify-between border border-white/5 bg-black/20 px-4 py-3">
              <div>
                <p className="text-xs font-mono font-bold tracking-wider">
                  VOICE-TO-VOICE
                </p>
                <p className="text-[10px] text-white/25 font-mono mt-0.5">
                  ElevenLabs natural voice (Pro/Elite)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVoiceToVoice(!voiceToVoice)}
                className={`relative h-6 w-11 transition ${
                  voiceToVoice
                    ? "bg-neon-purple/40 border border-neon-purple/50"
                    : "bg-white/10 border border-white/10"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 bg-white shadow transition-transform ${
                    voiceToVoice ? "translate-x-5.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Trading toggle */}
            <div className="flex items-center justify-between border border-neon-amber/10 bg-neon-amber/[0.02] px-4 py-3">
              <div>
                <p className="text-xs font-mono font-bold tracking-wider text-neon-amber/80">
                  TRADING MODULE
                </p>
                <p className="text-[10px] text-white/25 font-mono mt-0.5">
                  Dashboard, Bot Control, Trades, MT5
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTradingEnabled(!tradingEnabled)}
                className={`relative h-6 w-11 transition ${
                  tradingEnabled
                    ? "bg-neon-amber/40 border border-neon-amber/50"
                    : "bg-white/10 border border-white/10"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 bg-white shadow transition-transform ${
                    tradingEnabled ? "translate-x-5.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {error && (
              <div className="border border-neon-red/30 bg-neon-red/5 px-4 py-3 text-xs font-mono text-neon-red">
                ERROR: {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-3 text-[11px] font-mono font-bold uppercase tracking-[0.3em] text-neon-cyan transition hover:bg-neon-cyan/20 hover:shadow-glow-cyan disabled:opacity-30"
            >
              {loading ? "GENERATING..." : "GENERATE QR CODE"}
            </button>
          </form>
        </section>

        {/* QR Result */}
        <section>
          {result && qrImgUrl ? (
            <div className="border border-white/5 bg-dark-card/60 p-7 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/30 to-transparent" />
              <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
                scan.to.onboard
              </p>
              <div className="flex justify-center mb-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImgUrl}
                  alt="QR Code"
                  width={200}
                  height={200}
                  className="border border-neon-cyan/10"
                  style={{ filter: "invert(1) hue-rotate(120deg)" }}
                />
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between border border-white/5 bg-black/30 px-4 py-2.5">
                  <span className="text-white/30">CLIENT_ID</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/50">
                      {result.clientId.slice(0, 12)}...
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(result.clientId, "id")}
                      className="text-[10px] text-neon-cyan/60 hover:text-neon-cyan"
                    >
                      {copied === "id" ? "COPIED" : "COPY"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between border border-white/5 bg-black/30 px-4 py-2.5">
                  <span className="text-white/30">EXPIRES</span>
                  <span className="text-white/50">
                    {new Date(result.expiresAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-white/5 bg-black/30 px-4 py-2.5">
                  <span className="text-white/30">QR_URL</span>
                  <button
                    type="button"
                    onClick={() => copy(qrImgUrl, "url")}
                    className="text-[10px] text-neon-cyan/60 hover:text-neon-cyan"
                  >
                    {copied === "url" ? "COPIED" : "COPY LINK"}
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span
                    className={`border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.2em] font-bold ${
                      TIER_BADGE[result.qrPayload.tier]
                    }`}
                  >
                    {result.qrPayload.tier}
                  </span>
                  {result.qrPayload.voiceToVoice && (
                    <span className="border border-neon-purple/30 bg-neon-purple/5 px-2.5 py-0.5 text-[9px] text-neon-purple uppercase tracking-[0.2em] font-bold">
                      Voice
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center border border-dashed border-white/5 bg-dark-card/30 p-10 text-center">
              <div>
                <div className="text-4xl mb-3 text-white/10">[ ]</div>
                <p className="text-[11px] font-mono text-white/20 tracking-wider">
                  QR CODE AWAITING GENERATION
                </p>
                <p className="text-[10px] font-mono text-white/10 mt-1">
                  Fill form and execute
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Client list */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
            provisioned.nodes
          </p>
          <span className="text-[9px] text-neon-cyan/30 font-mono">
            // {clients.length} TOTAL
          </span>
        </div>
        <div className="overflow-hidden border border-white/5">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-white/5 bg-dark-card/80 text-[9px] uppercase tracking-[0.3em] text-white/20">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Tier</th>
                <th className="px-4 py-3 text-left">Voice</th>
                <th className="px-4 py-3 text-left">Trading</th>
                <th className="px-4 py-3 text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-white/[0.03] hover:bg-neon-cyan/[0.02] transition"
                >
                  <td className="px-4 py-3 font-bold tracking-wider text-white/80">
                    {c.name.toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-white/30">{c.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.2em] font-bold ${
                        TIER_BADGE[c.subscription_tier]
                      }`}
                    >
                      {c.subscription_tier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] ${
                        c.voice_to_voice_enabled
                          ? "text-neon-purple"
                          : "text-white/15"
                      }`}
                    >
                      {c.voice_to_voice_enabled ? "ACTIVE" : "OFF"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-bold ${
                        c.trading_enabled
                          ? "text-neon-amber"
                          : "text-white/15"
                      }`}
                    >
                      {c.trading_enabled ? "ON" : "OFF"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/25">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-white/15 tracking-wider"
                  >
                    NO NODES PROVISIONED
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
