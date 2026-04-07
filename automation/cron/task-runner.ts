import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TaskType =
  | "trade_execute"
  | "risk_check"
  | "report_generate"
  | "escalation";

interface Task {
  id: string;
  type: TaskType;
  status: "pending" | "processing" | "completed" | "failed";
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  attempts: number;
  max_attempts: number;
  result: Record<string, unknown> | null;
  error: string | null;
}

interface AuditLogEntry {
  task_id: string;
  task_type: TaskType;
  status: "completed" | "failed";
  result: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number;
  executed_at: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 3;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY
);

let running = true;

// ---------------------------------------------------------------------------
// Task Handlers
// ---------------------------------------------------------------------------

async function handleTradeExecute(
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const clientId = payload.client_id as string;
  const signal = payload.signal as Record<string, unknown>;

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientErr || !client) {
    throw new Error(`Client ${clientId} not found: ${clientErr?.message}`);
  }

  if (client.trading_paused) {
    return {
      executed: false,
      reason: "trading_paused",
      client_id: clientId,
    };
  }

  const tradeRecord = {
    client_id: clientId,
    symbol: signal.symbol,
    side: signal.side,
    price: signal.price,
    quantity: signal.quantity || 0,
    strategy: signal.strategy || "manual",
    source: signal.source || "task_queue",
    status: "pending_execution",
    created_at: new Date().toISOString(),
  };

  const { data: trade, error: tradeErr } = await supabase
    .from("trades")
    .insert(tradeRecord)
    .select()
    .single();

  if (tradeErr) {
    throw new Error(`Failed to insert trade: ${tradeErr.message}`);
  }

  return {
    executed: true,
    trade_id: trade.id,
    symbol: signal.symbol,
    side: signal.side,
    client_id: clientId,
  };
}

async function handleRiskCheck(
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const clientId = payload.client_id as string;

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientErr || !client) {
    throw new Error(`Client ${clientId} not found: ${clientErr?.message}`);
  }

  const tier = client.risk_tier || "conservative";
  const limits: Record<string, { maxDrawdown: number; maxPositions: number }> =
    {
      conservative: { maxDrawdown: 5, maxPositions: 5 },
      moderate: { maxDrawdown: 5, maxPositions: 10 },
      aggressive: { maxDrawdown: 5, maxPositions: 15 },
    };
  const tierLimits = limits[tier] || limits.conservative;

  const breaches: string[] = [];

  if ((client.current_drawdown_pct || 0) > tierLimits.maxDrawdown) {
    breaches.push(
      `Drawdown ${client.current_drawdown_pct}% exceeds ${tierLimits.maxDrawdown}%`
    );
  }

  if ((client.open_positions || 0) > tierLimits.maxPositions) {
    breaches.push(
      `${client.open_positions} positions exceeds ${tierLimits.maxPositions} limit`
    );
  }

  if (breaches.length > 0) {
    await supabase
      .from("clients")
      .update({ trading_paused: true, updated_at: new Date().toISOString() })
      .eq("id", clientId);
  }

  return {
    client_id: clientId,
    tier,
    breaches,
    trading_paused: breaches.length > 0,
    checked_at: new Date().toISOString(),
  };
}

async function handleReportGenerate(
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const clientId = payload.client_id as string;
  const reportType = (payload.report_type as string) || "daily_summary";
  const dateRange = (payload.date as string) || new Date().toISOString().split("T")[0];

  const { data: trades, error: tradesErr } = await supabase
    .from("trades")
    .select("*")
    .eq("client_id", clientId)
    .gte("created_at", `${dateRange}T00:00:00Z`)
    .lte("created_at", `${dateRange}T23:59:59Z`);

  if (tradesErr) {
    throw new Error(`Failed to fetch trades: ${tradesErr.message}`);
  }

  const tradeList = trades || [];
  let totalPnl = 0;
  let wins = 0;
  let losses = 0;

  for (const trade of tradeList) {
    const pnl = parseFloat(trade.pnl || "0");
    totalPnl += pnl;
    if (pnl > 0) wins++;
    else if (pnl < 0) losses++;
  }

  const report = {
    client_id: clientId,
    report_type: reportType,
    date: dateRange,
    total_trades: tradeList.length,
    wins,
    losses,
    total_pnl: totalPnl.toFixed(2),
    win_rate:
      wins + losses > 0
        ? ((wins / (wins + losses)) * 100).toFixed(1)
        : "0.0",
    generated_at: new Date().toISOString(),
  };

  const { error: reportErr } = await supabase.from("reports").insert(report);

  if (reportErr) {
    throw new Error(`Failed to save report: ${reportErr.message}`);
  }

  return report;
}

async function handleEscalation(
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const clientId = payload.client_id as string;
  const severity = (payload.severity as string) || "P1";
  const reason = (payload.reason as string) || "unknown";

  if (severity === "P0") {
    await supabase
      .from("clients")
      .update({ trading_paused: true, updated_at: new Date().toISOString() })
      .eq("id", clientId);
  }

  const escalation = {
    client_id: clientId,
    severity,
    reason,
    breaches: payload.breaches || [],
    action_taken:
      severity === "P0"
        ? "immediate_halt_all_trading"
        : "flagged_for_review",
    requires_manual_review: true,
    created_at: new Date().toISOString(),
    resolved: false,
  };

  const { error: escErr } = await supabase
    .from("escalations")
    .insert(escalation);

  if (escErr) {
    throw new Error(`Failed to create escalation: ${escErr.message}`);
  }

  return {
    escalation_created: true,
    client_id: clientId,
    severity,
    action_taken: escalation.action_taken,
  };
}

// ---------------------------------------------------------------------------
// Task Processor
// ---------------------------------------------------------------------------

async function processTask(task: Task): Promise<void> {
  const startTime = Date.now();

  // Mark task as processing
  const { error: updateErr } = await supabase
    .from("task_queue")
    .update({
      status: "processing",
      updated_at: new Date().toISOString(),
      attempts: task.attempts + 1,
    })
    .eq("id", task.id)
    .eq("status", "pending");

  // Another worker grabbed it first
  if (updateErr) {
    console.log(`Task ${task.id} already claimed, skipping.`);
    return;
  }

  let result: Record<string, unknown> | null = null;
  let error: string | null = null;
  let status: "completed" | "failed" = "completed";

  try {
    switch (task.type) {
      case "trade_execute":
        result = await handleTradeExecute(task.payload);
        break;
      case "risk_check":
        result = await handleRiskCheck(task.payload);
        break;
      case "report_generate":
        result = await handleReportGenerate(task.payload);
        break;
      case "escalation":
        result = await handleEscalation(task.payload);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : String(err);

    // Retry logic: put back to pending if under max attempts
    if (task.attempts + 1 < (task.max_attempts || MAX_ATTEMPTS)) {
      status = "failed";
      await supabase
        .from("task_queue")
        .update({
          status: "pending",
          error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);

      console.warn(
        `Task ${task.id} (${task.type}) failed, will retry. Attempt ${task.attempts + 1}/${task.max_attempts || MAX_ATTEMPTS}: ${error}`
      );

      await writeAuditLog({
        task_id: task.id,
        task_type: task.type,
        status: "failed",
        result: null,
        error,
        duration_ms: Date.now() - startTime,
        executed_at: new Date().toISOString(),
      });

      return;
    }
  }

  // Final status update
  await supabase
    .from("task_queue")
    .update({
      status,
      result,
      error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id);

  const durationMs = Date.now() - startTime;

  await writeAuditLog({
    task_id: task.id,
    task_type: task.type,
    status,
    result,
    error,
    duration_ms: durationMs,
    executed_at: new Date().toISOString(),
  });

  if (status === "completed") {
    console.log(
      `Task ${task.id} (${task.type}) completed in ${durationMs}ms`
    );
  } else {
    console.error(
      `Task ${task.id} (${task.type}) failed permanently after ${task.attempts + 1} attempts: ${error}`
    );
  }
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const { error } = await supabase.from("audit_log").insert(entry);
  if (error) {
    console.error(`Failed to write audit log for task ${entry.task_id}:`, error.message);
  }
}

// ---------------------------------------------------------------------------
// Poll Loop
// ---------------------------------------------------------------------------

async function pollForTasks(): Promise<void> {
  const { data: tasks, error } = await supabase
    .from("task_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error("Error polling task_queue:", error.message);
    return;
  }

  if (!tasks || tasks.length === 0) {
    return;
  }

  console.log(`Found ${tasks.length} pending task(s)`);

  for (const task of tasks as Task[]) {
    if (!running) break;
    await processTask(task);
  }
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

function setupShutdownHandlers(): void {
  const shutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    running = false;
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Mars Agent Task Runner starting...");
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Poll interval: ${POLL_INTERVAL_MS / 1000}s`);

  setupShutdownHandlers();

  // Verify connection
  const { error: pingErr } = await supabase
    .from("task_queue")
    .select("id")
    .limit(1);

  if (pingErr) {
    console.error("Failed to connect to Supabase:", pingErr.message);
    process.exit(1);
  }

  console.log("Connected to Supabase. Polling for tasks...");

  while (running) {
    await pollForTasks();

    if (running) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, POLL_INTERVAL_MS)
      );
    }
  }

  console.log("Task runner stopped.");
}

main().catch((err) => {
  console.error("Fatal error in task runner:", err);
  process.exit(1);
});
