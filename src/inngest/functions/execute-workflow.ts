import { Engine, type Workflow } from "@inngest/workflow-kit";
import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { engineActions } from "../engine-actions";

const workflowEngine = new Engine({
  actions: engineActions,
  disableBuiltinActions: true,
});

export const executeWorkflow = inngest.createFunction(
  {
    id: "execute-workflow",
    triggers: [{ event: "workflow/execution.requested" }],
    cancelOn: [
      {
        event: "workflow/execution.cancelled",
        if: "event.data.executionId == async.data.executionId",
      },
    ],
  },
  async ({ event, step }) => {
    const { versionId, executionId } = event.data as {
      workflowId: string;
      versionId: string;
      executionId: string;
      triggerData: Record<string, unknown>;
      teamId: string;
    };

    const db = createAdminClient();

    // Mark execution as running
    await step.run("mark-execution-running", async () => {
      await db
        .from("workflow_executions")
        .update({ status: "running" })
        .eq("id", executionId);
    });

    // Load workflow definition (Inngest Workflow format)
    const workflow = await step.run("load-definition", async () => {
      const { data, error } = await db
        .from("workflow_versions")
        .select("definition")
        .eq("id", versionId)
        .single();
      if (error || !data) throw new Error(`Failed to load version: ${error?.message}`);
      return data.definition as Workflow;
    });

    try {
      // Run the workflow via the Engine
      await workflowEngine.run({ event, step, workflow });

      // Mark execution completed
      await step.run("mark-execution-completed", async () => {
        await db
          .from("workflow_executions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", executionId);
      });

      return { executionId, status: "completed" };
    } catch (err) {
      await step.run("mark-execution-failed", async () => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await db
          .from("workflow_executions")
          .update({ status: "failed", completed_at: new Date().toISOString(), error: errorMsg })
          .eq("id", executionId);
      });
      throw err;
    }
  }
);
