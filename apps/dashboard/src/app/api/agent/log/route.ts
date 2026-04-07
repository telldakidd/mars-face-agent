import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, action_type, description, confidence, metadata } = body;

    if (!client_id || !action_type || !description) {
      return NextResponse.json(
        { error: "Missing required fields: client_id, action_type, description" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("agent_activity").insert({
      client_id,
      action_type,
      description,
      confidence: confidence ?? null,
      metadata: metadata ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
