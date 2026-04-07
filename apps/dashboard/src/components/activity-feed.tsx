"use client";

import React from "react";

interface Activity {
  action_type: string;
  description: string;
  confidence: number;
  created_at: string;
}

interface ActivityFeedProps {
  activities: Activity[];
}

const typeStyles: Record<string, { border: string; text: string; glow: string }> = {
  trade: { border: "border-l-neon-cyan", text: "text-neon-cyan", glow: "" },
  alert: { border: "border-l-neon-amber", text: "text-neon-amber", glow: "" },
  risk: { border: "border-l-neon-red", text: "text-neon-red", glow: "card-danger-glow" },
  info: { border: "border-l-white/20", text: "text-white/50", glow: "" },
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {activities.map((activity, idx) => {
        const style = typeStyles[activity.action_type] ?? typeStyles.info;
        return (
          <div
            key={idx}
            className={`border border-white/5 border-l-2 bg-black/30 px-4 py-3 ${style.border} ${style.glow}`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[9px] font-mono font-bold uppercase tracking-[0.3em] ${style.text}`}
              >
                {activity.action_type}
              </span>
              <span className="text-[9px] text-white/20 font-mono">
                {relativeTime(activity.created_at)} AGO
              </span>
            </div>
            <p className="mt-1 text-[11px] font-mono text-white/50">
              {activity.description}
            </p>
            {activity.confidence != null && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-[2px] flex-1 overflow-hidden bg-white/5">
                  <div
                    className="h-full bg-neon-cyan/40"
                    style={{
                      width: `${Math.round(activity.confidence * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-white/25 font-mono">
                  {Math.round(activity.confidence * 100)}%
                </span>
              </div>
            )}
          </div>
        );
      })}
      {activities.length === 0 && (
        <p className="py-8 text-center text-[10px] font-mono text-white/15 tracking-wider">
          NO ACTIVITY DETECTED
        </p>
      )}
    </div>
  );
}
