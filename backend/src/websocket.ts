import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { supabase } from "./lib/supabase.js";

// Map: clientId → Set of open WebSocket connections
const connections = new Map<string, Set<WebSocket>>();

export function initWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    let clientId: string | null = null;

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

        // First message must be auth
        if (msg.type === "auth") {
          const token = msg.token as string;
          const { data, error } = await supabase.auth.getUser(token);
          if (error || !data.user) {
            ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
            ws.close();
            return;
          }
          clientId = data.user.id;
          if (!connections.has(clientId)) connections.set(clientId, new Set());
          connections.get(clientId)!.add(ws);
          ws.send(JSON.stringify({ type: "connected", clientId }));
          console.log(`[ws] Client connected: ${clientId.slice(0, 8)}`);
          return;
        }

        // Ping/pong keepalive
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }

        // Device ack for phone commands
        if (msg.type === "phone_command_ack" && clientId) {
          console.log(`[ws] Phone command ack from ${clientId.slice(0, 8)}: ${msg.command}`);
          return;
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      if (clientId) {
        connections.get(clientId)?.delete(ws);
        if (connections.get(clientId)?.size === 0) {
          connections.delete(clientId);
        }
        console.log(`[ws] Client disconnected: ${clientId.slice(0, 8)}`);
      }
    });

    ws.on("error", (err) => {
      console.error("[ws] Error:", err.message);
    });
  });

  console.log("[ws] WebSocket server ready on /ws");
  return wss;
}

// Send a message to all connections for a specific client
export function broadcastToClient(
  clientId: string,
  payload: Record<string, unknown>
): void {
  const sockets = connections.get(clientId);
  if (!sockets || sockets.size === 0) {
    console.log(`[ws] No active connections for client ${clientId.slice(0, 8)}`);
    return;
  }
  const message = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

// Broadcast to ALL connected clients (alerts, system messages)
export function broadcastAll(payload: Record<string, unknown>): void {
  const message = JSON.stringify(payload);
  for (const sockets of connections.values()) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}

export function getConnectedClients(): string[] {
  return Array.from(connections.keys());
}
