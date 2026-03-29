import type { EngineAction } from "@inngest/workflow-kit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  executeSlackSendMessage,
  executeGmailSendEmail,
  executeGoogleSheetsAppendRow,
  executeHttpRequest,
} from "@/lib/integrations/actions";
import { actionsDefinition } from "./actions-definition";

/**
 * Engine actions with backend handlers.
 * These extend the public definitions and add execution logic.
 */
export const engineActions: EngineAction[] = [
  {
    ...actionsDefinition[0], // slack_send_message
    handler: async ({ event, step, workflowAction }) => {
      const { teamId, executionId } = event.data as { teamId: string; executionId: string };
      const inputs = workflowAction.inputs ?? {};

      return await step.run(`action-${workflowAction.id}-slack`, async () => {
        const db = createAdminClient();
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "slack")
          .single();
        if (!conn) throw new Error("Slack not connected for this team");

        const result = await executeSlackSendMessage(conn.nango_connection_id, {
          channel: String(inputs.channel ?? ""),
          message: String(inputs.message ?? ""),
        });

        await db.from("execution_steps").insert({
          execution_id: executionId,
          node_id: workflowAction.id,
          step_name: workflowAction.name ?? "Send Slack Message",
          status: "completed",
          output_data: result,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        return result;
      });
    },
  },
  {
    ...actionsDefinition[1], // gmail_send_email
    handler: async ({ event, step, workflowAction }) => {
      const { teamId, executionId } = event.data as { teamId: string; executionId: string };
      const inputs = workflowAction.inputs ?? {};

      return await step.run(`action-${workflowAction.id}-gmail`, async () => {
        const db = createAdminClient();
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "gmail")
          .single();
        if (!conn) throw new Error("Gmail not connected for this team");

        const result = await executeGmailSendEmail(conn.nango_connection_id, {
          to: String(inputs.to ?? ""),
          subject: String(inputs.subject ?? ""),
          body: String(inputs.body ?? ""),
        });

        await db.from("execution_steps").insert({
          execution_id: executionId,
          node_id: workflowAction.id,
          step_name: workflowAction.name ?? "Send Email",
          status: "completed",
          output_data: result,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        return result;
      });
    },
  },
  {
    ...actionsDefinition[2], // google_sheets_append_row
    handler: async ({ event, step, workflowAction }) => {
      const { teamId, executionId } = event.data as { teamId: string; executionId: string };
      const inputs = workflowAction.inputs ?? {};

      return await step.run(`action-${workflowAction.id}-sheets`, async () => {
        const db = createAdminClient();
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "google-sheets")
          .single();
        if (!conn) throw new Error("Google Sheets not connected for this team");

        const valuesRaw = String(inputs.values ?? "");
        const values = valuesRaw.split(",").map((v) => v.trim());

        const result = await executeGoogleSheetsAppendRow(conn.nango_connection_id, {
          spreadsheet_id: String(inputs.spreadsheet_id ?? ""),
          sheet_name: String(inputs.sheet_name ?? "Sheet1"),
          values,
        });

        await db.from("execution_steps").insert({
          execution_id: executionId,
          node_id: workflowAction.id,
          step_name: workflowAction.name ?? "Append Sheet Row",
          status: "completed",
          output_data: result,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        return result;
      });
    },
  },
  {
    ...actionsDefinition[3], // http_request
    handler: async ({ event, step, workflowAction }) => {
      const { executionId } = event.data as { executionId: string };
      const inputs = workflowAction.inputs ?? {};

      return await step.run(`action-${workflowAction.id}-http`, async () => {
        const result = await executeHttpRequest({
          url: String(inputs.url ?? ""),
          method: String(inputs.method ?? "GET"),
          body: inputs.body ? String(inputs.body) : undefined,
        });

        const db = createAdminClient();
        await db.from("execution_steps").insert({
          execution_id: executionId,
          node_id: workflowAction.id,
          step_name: workflowAction.name ?? "HTTP Request",
          status: "completed",
          output_data: result,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        return result;
      });
    },
  },
  {
    ...actionsDefinition[4], // logic_delay
    handler: async ({ step, workflowAction }) => {
      const duration = String(workflowAction.inputs?.duration ?? "1m");
      await step.sleep(`action-${workflowAction.id}-delay`, duration);
      return { delayed: true, duration };
    },
  },
  {
    ...actionsDefinition[5], // builtin:if
    handler: async ({ step, workflowAction }) => {
      return await step.run(`action-${workflowAction.id}-condition`, async () => {
        const conditionStr = String(workflowAction.inputs?.condition ?? "");
        if (!conditionStr.trim()) return { result: true };
        try {
          const condition = JSON.parse(conditionStr) as unknown;
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const jsonLogic = require("json-logic-js") as { apply: (logic: unknown, data?: unknown) => unknown };
          const result = jsonLogic.apply(condition);
          return { result: !!result };
        } catch {
          throw new Error("Invalid condition JSON: " + conditionStr);
        }
      });
    },
  },
];
