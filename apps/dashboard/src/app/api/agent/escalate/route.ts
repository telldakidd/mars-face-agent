import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, reason, severity } = body;

    if (!client_id || !reason || !severity) {
      return NextResponse.json(
        { error: "Missing required fields: client_id, reason, severity" },
        { status: 400 }
      );
    }

    // Insert high-priority task into task_queue
    const { error: taskError } = await supabase.from("task_queue").insert({
      client_id,
      task_type: "escalation",
      priority: "high",
      payload: { reason, severity },
      status: "pending",
    });

    if (taskError) {
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    // Insert into audit_log
    const { error: auditError } = await supabase.from("audit_log").insert({
      client_id,
      event_type: "escalation",
      details: { reason, severity },
    });

    if (auditError) {
      return NextResponse.json({ error: auditError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
