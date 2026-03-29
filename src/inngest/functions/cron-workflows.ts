import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Runs every minute, checks for active cron-triggered workflows,
 * and dispatches execution events for those whose cron matches.
 */
export const cronTriggerCheck = inngest.createFunction(
  { id: "cron-trigger-check", triggers: [{ cron: "* * * * *" }] },
  async ({ step }) => {
    const db = createAdminClient();

    const workflows = await step.run("load-cron-workflows", async () => {
      const { data, error } = await db
        .from("workflows")
        .select("id, team_id, trigger_config")
        .eq("status", "active")
        .eq("trigger_type", "cron")
        .is("deleted_at", null);
      if (error) throw new Error(`Failed to load cron workflows: ${error.message}`);
      return data ?? [];
    });

    if (workflows.length === 0) return { triggered: 0 };

    // For each matching cron workflow, check if it should run now
    const now = new Date();
    const triggered: string[] = [];

    for (const workflow of workflows) {
      const config = workflow.trigger_config as { cron_expression?: string };
      if (!config.cron_expression) continue;

      // Simple cron matching — check if cron matches current minute
      if (!cronMatchesNow(config.cron_expression, now)) continue;

      await step.run(`trigger-${workflow.id}`, async () => {
        // Get latest version
        const { data: version } = await db
          .from("workflow_versions")
          .select("id")
          .eq("workflow_id", workflow.id)
          .order("version_number", { ascending: false })
          .limit(1)
          .single();

        if (!version) return;

        // Create execution record
        const { data: execution } = await db
          .from("workflow_executions")
          .insert({
            workflow_id: workflow.id,
            workflow_version_id: version.id,
            status: "pending",
            trigger_data: { source: "cron", triggered_at: now.toISOString() },
          })
          .select("id")
          .single();

        if (!execution) return;

        // Dispatch execution event
        await inngest.send({
          name: "workflow/execution.requested",
          data: {
            workflowId: workflow.id,
            versionId: version.id,
            executionId: execution.id,
            teamId: workflow.team_id,
            triggerData: { source: "cron", triggered_at: now.toISOString() },
          },
        });

        triggered.push(workflow.id);
      });
    }

    return { triggered: triggered.length, workflowIds: triggered };
  }
);

/**
 * Simple cron expression matching for: minute hour day-of-month month day-of-week
 * Supports: *, specific numbers, and step values (e.g. *\/5)
 */
function cronMatchesNow(expression: string, now: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const fields = [
    now.getMinutes(),   // 0-59
    now.getHours(),     // 0-23
    now.getDate(),      // 1-31
    now.getMonth() + 1, // 1-12
    now.getDay(),       // 0-6
  ];

  return parts.every((part, i) => cronFieldMatches(part, fields[i]));
}

function cronFieldMatches(pattern: string, value: number): boolean {
  if (pattern === "*") return true;

  // Step values: */5
  const stepMatch = pattern.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    return value % parseInt(stepMatch[1], 10) === 0;
  }

  // Comma-separated values: 1,5,10
  const values = pattern.split(",").map((v) => parseInt(v.trim(), 10));
  return values.includes(value);
}
