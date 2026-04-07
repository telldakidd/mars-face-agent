import { Router, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAvatarSession, endAvatarSession, createReplica, getReplicaStatus } from "../services/tavus.js";

export const avatarRouter = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const BUCKET = "replica-videos"; // Create this public bucket in Supabase dashboard

// POST /api/avatar/session — create a new Tavus CVI session for a client
const SessionSchema = z.object({ clientId: z.string().uuid() });

avatarRouter.post("/session", async (req: Request, res: Response) => {
  const parsed = SessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() }); return;
  }

  try {
    // Load client's avatar config
    const { data: config } = await supabase
      .from("agent_config")
      .select("tavus_replica_id, avatar_language, avatar_greeting, session_duration_mins")
      .eq("client_id", parsed.data.clientId)
      .single();

    const session = await createAvatarSession(parsed.data.clientId, {
      replicaId:           config?.tavus_replica_id       || undefined,
      language:            config?.avatar_language         || "en",
      greeting:            config?.avatar_greeting         || "",
      maxCallDurationMins: config?.session_duration_mins   || 30,
    });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /api/avatar/session/:conversationId — end a Tavus CVI session
avatarRouter.delete("/session/:conversationId", async (req: Request, res: Response) => {
  try {
    await endAvatarSession(req.params.conversationId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/avatar/defaults — list all Tavus system replicas (for the avatar picker)
avatarRouter.get("/defaults", async (_req: Request, res: Response) => {
  try {
    const r = await fetch("https://tavusapi.com/v2/replicas?verbose=true", {
      headers: { "x-api-key": process.env.TAVUS_API_KEY ?? "" },
    });
    const data = await r.json() as { data?: unknown[] };
    const replicas = ((data.data ?? []) as Array<{
      replica_id: string;
      replica_name: string;
      replica_type: string;
      status: string;
      tags: Array<{ tag_name: string }>;
      thumbnail_video_url?: string;
    }>)
      .filter(rep => rep.replica_type === "system" && rep.status === "completed")
      .map(rep => ({
        replicaId:    rep.replica_id,
        replicaName:  rep.replica_name,
        tags:         rep.tags.map(t => t.tag_name),
        thumbnailUrl: rep.thumbnail_video_url ?? "",
      }));
    res.json(replicas);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/avatar/upload-url — get a signed Supabase Storage upload URL for a replica video
// NOTE: Create a public bucket called "replica-videos" in your Supabase dashboard first.
avatarRouter.post("/upload-url", async (req: Request, res: Response) => {
  const { clientId } = req.body;
  if (!clientId) { res.status(400).json({ error: "clientId required" }); return; }

  const path = `${clientId}/replica-${Date.now()}.mp4`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) { res.status(500).json({ error: error.message }); return; }

  const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  res.json({ signedUploadUrl: data.signedUrl, publicUrl, path });
});

// POST /api/avatar/replica — submit video to Tavus and start replica training
avatarRouter.post("/replica", async (req: Request, res: Response) => {
  const { clientId, videoUrl, replicaName } = req.body;
  if (!clientId || !videoUrl) {
    res.status(400).json({ error: "clientId and videoUrl required" }); return;
  }

  try {
    const name = (replicaName as string | undefined)?.trim() || `${(clientId as string).slice(0, 8)}-replica`;
    const replica = await createReplica(videoUrl, name);

    // Persist replica ID to agent_config immediately so status can be polled
    await supabase.from("agent_config").upsert(
      { client_id: clientId, tavus_replica_id: replica.replicaId, updated_at: new Date().toISOString() },
      { onConflict: "client_id" }
    );

    res.json(replica);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/avatar/replica/:replicaId — poll Tavus training status
avatarRouter.get("/replica/:replicaId", async (req: Request, res: Response) => {
  try {
    const status = await getReplicaStatus(req.params.replicaId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
