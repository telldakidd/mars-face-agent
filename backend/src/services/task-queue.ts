import { supabase } from "../lib/supabase.js";

/**
 * Task queue service backed by the `task_queue` Supabase table.
 * Provides enqueue/dequeue/complete semantics with priority ordering.
 */

export interface Task {
  id: string;
  client_id: string;
  task_type: string;
  payload: Record<string, unknown>;
  status: string;
  priority: number;
  scheduled_for: string | null;
  completed_at: string | null;
  created_at: string;
}

export class TaskQueueService {
  /**
   * Insert a new task into the queue.
   * @param clientId - Owning client UUID.
   * @param taskType - Type identifier (e.g. "tradingview_signal", "rebalance").
   * @param payload - Arbitrary JSON payload for the task.
   * @param priority - 1 (highest) to 10 (lowest). Default 5.
   * @param scheduledFor - Optional ISO timestamp to delay execution.
   * @returns The inserted task row, or null on error.
   */
  async enqueue(
    clientId: string,
    taskType: string,
    payload: Record<string, unknown> = {},
    priority = 5,
    scheduledFor?: string
  ): Promise<Task | null> {
    const { data, error } = await supabase
      .from("task_queue")
      .insert({
        client_id: clientId,
        task_type: taskType,
        payload,
        priority,
        status: "pending",
        scheduled_for: scheduledFor ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("[task-queue] enqueue error:", error.message);
      return null;
    }

    return data as Task;
  }

  /**
   * Fetch the next batch of pending tasks, ordered by priority then scheduled time.
   * @param limit - Maximum tasks to dequeue. Default 10.
   * @returns Array of pending tasks.
   */
  async dequeue(limit = 10): Promise<Task[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("task_queue")
      .select("*")
      .eq("status", "pending")
      .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
      .order("priority", { ascending: true })
      .order("scheduled_for", { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) {
      console.error("[task-queue] dequeue error:", error.message);
      return [];
    }

    return (data ?? []) as Task[];
  }

  /**
   * Mark a task as completed.
   * @param taskId - The UUID of the task to complete.
   */
  async complete(taskId: string): Promise<void> {
    const { error } = await supabase
      .from("task_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      console.error("[task-queue] complete error:", error.message);
    }
  }

  /**
   * Get all pending tasks for a specific client.
   * @param clientId - The client UUID.
   * @returns Array of pending tasks for the client.
   */
  async getClientTasks(clientId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from("task_queue")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "pending")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[task-queue] getClientTasks error:", error.message);
      return [];
    }

    return (data ?? []) as Task[];
  }
}
