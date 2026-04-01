import { createAdminClient } from "@/lib/supabase/admin";

export type LogLevel = "info" | "warn" | "error";

export interface ExecutionLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Creates a logger that writes to `execution_logs` (fire-and-forget, non-blocking).
 * Also mirrors to console so server logs still work.
 */
export function createExecutionLogger(executionId: string): ExecutionLogger {
  function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    // Mirror to console
    const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleMethod(`[execution:${executionId}] ${message}`, data ?? "");

    // Write to DB — fire and forget, never block the workflow
    const db = createAdminClient();
    db.from("execution_logs")
      .insert({ execution_id: executionId, level, message, data: data ?? null })
      .then(({ error }) => {
        if (error) console.error(`[execution-logger] failed to write log:`, error.message);
      });
  }

  return {
    info: (msg, data) => log("info", msg, data),
    warn: (msg, data) => log("warn", msg, data),
    error: (msg, data) => log("error", msg, data),
  };
}
