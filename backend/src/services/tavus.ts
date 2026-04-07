import { loadClientMemory } from "./memory.js";

const TAVUS_API_KEY    = process.env.TAVUS_API_KEY   ?? "";
const TAVUS_REPLICA_ID = process.env.TAVUS_REPLICA_ID ?? "";
const TAVUS_BASE       = "https://tavusapi.com/v2";

export interface AvatarSession {
  conversationId:  string;
  conversationUrl: string;
}

export interface ReplicaStatus {
  replicaId:   string;
  status:      "queued" | "training" | "ready" | "error";
  replicaName: string;
}

// ── Replica creation ──────────────────────────────────────────────────────────

export async function createReplica(videoUrl: string, replicaName: string): Promise<ReplicaStatus> {
  if (!TAVUS_API_KEY) throw new Error("TAVUS_API_KEY not configured");

  const res = await fetch(`${TAVUS_BASE}/replicas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": TAVUS_API_KEY,
    },
    body: JSON.stringify({
      train_video_url: videoUrl,
      replica_name:    replicaName,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tavus replica creation failed ${res.status}: ${err}`);
  }

  const data = await res.json() as { replica_id: string; status: string; replica_name: string };
  return {
    replicaId:   data.replica_id,
    status:      (data.status ?? "queued") as ReplicaStatus["status"],
    replicaName: data.replica_name,
  };
}

export async function getReplicaStatus(replicaId: string): Promise<ReplicaStatus> {
  if (!TAVUS_API_KEY) throw new Error("TAVUS_API_KEY not configured");

  const res = await fetch(`${TAVUS_BASE}/replicas/${replicaId}`, {
    headers: { "x-api-key": TAVUS_API_KEY },
  });

  if (!res.ok) throw new Error(`Tavus replica status failed: ${res.status}`);

  const data = await res.json() as { replica_id: string; status: string; replica_name: string };
  return {
    replicaId:   data.replica_id,
    status:      (data.status ?? "training") as ReplicaStatus["status"],
    replicaName: data.replica_name,
  };
}

// ── Avatar session creation ───────────────────────────────────────────────────

interface AvatarSessionOptions {
  replicaId?: string;
  language?: string;
  greeting?: string;
  maxCallDurationMins?: number;
}

export async function createAvatarSession(clientId: string, options: AvatarSessionOptions = {}): Promise<AvatarSession> {
  const {
    replicaId: customReplicaId,
    language = "en",
    greeting = "",
    maxCallDurationMins = 30,
  } = options;

  const replicaId = customReplicaId || TAVUS_REPLICA_ID;
  if (!TAVUS_API_KEY || !replicaId) {
    throw new Error("No replica configured. Create your face replica in the HUD → Customize tab.");
  }

  // Load client memory so the avatar already knows the client
  const context = await loadClientMemory(clientId).catch(() => "");

  const greetingInstruction = greeting.trim()
    ? `\n\nStart the conversation by greeting the user with exactly: "${greeting.trim()}"`
    : "";

  const baseContext = context
    ? `You are Mars, the user's personal AI assistant living on their Google Pixel phone. You are their primary assistant — smarter and more capable than Google Assistant or Siri.

You can control their phone completely (brightness, volume, WiFi, Bluetooth, flashlight, apps, lock screen), send texts, make calls, set alarms, search the web, and answer any question.

Here is what you know about this user:
${context}

Be natural, warm, and conversational. When the user asks you to do something, confirm it confidently and briefly. Keep responses short — this is a voice conversation.`
    : `You are Mars, the user's personal AI assistant on their Google Pixel phone. You are their primary assistant — smarter and more capable than Google Assistant or Siri.

You can control their phone completely (brightness, volume, WiFi, Bluetooth, flashlight, apps, lock screen), send texts, make calls, set alarms, search the web, and answer any question.

Be natural, warm, and conversational. Keep responses short — this is a voice conversation.`;

  const body = {
    replica_id: replicaId,
    conversation_name: `Mars-${clientId.slice(0, 8)}`,
    conversational_context: baseContext + greetingInstruction,
    language,
    properties: {
      max_call_duration: maxCallDurationMins * 60,
      participant_left_timeout: 30,
      enable_recording: false,
    },
  };

  const res = await fetch(`${TAVUS_BASE}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": TAVUS_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tavus API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { conversation_id: string; conversation_url: string };

  return {
    conversationId:  data.conversation_id,
    conversationUrl: data.conversation_url,
  };
}

export async function endAvatarSession(conversationId: string): Promise<void> {
  if (!TAVUS_API_KEY) return;

  await fetch(`${TAVUS_BASE}/conversations/${conversationId}`, {
    method: "DELETE",
    headers: { "x-api-key": TAVUS_API_KEY },
  }).catch(() => {
    // Best-effort — session may have already expired
  });
}
