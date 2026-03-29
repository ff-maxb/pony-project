import type { EngineAction } from "@inngest/workflow-kit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  executeSlackSendMessage,
  executeGmailSendEmail,
  executeGoogleSheetsAppendRow,
  executeHttpRequest,
  executeLinearCreateIssue,
  executeLinearUpdateIssue,
  executeCalendlyCreateSchedulingLink,
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
    handler: async ({ event, step, workflowAction }) => {
      const { executionId } = event.data as { executionId: string };
      const duration = String(workflowAction.inputs?.duration ?? "1m");
      await step.sleep(`action-${workflowAction.id}-delay`, duration);

      const db = createAdminClient();
      await db.from("execution_steps").insert({
        execution_id: executionId,
        node_id: workflowAction.id,
        step_name: workflowAction.name ?? "Delay",
        status: "completed",
        output_data: { delayed: true, duration },
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

      return { delayed: true, duration };
    },
  },
  {
    ...actionsDefinition[5], // builtin:if
    handler: async ({ event, step, workflowAction }) => {
      const { executionId } = event.data as { executionId: string };
      const result = await step.run(`action-${workflowAction.id}-condition`, async () => {
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

      const db = createAdminClient();
      await db.from("execution_steps").insert({
        execution_id: executionId,
        node_id: workflowAction.id,
        step_name: workflowAction.name ?? "If / Condition",
        status: "completed",
        output_data: result as Record<string, unknown>,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

      return result;
    },
  },
  {
    ...actionsDefinition[6], // linear_create_issue
    handler: async ({ event, step, workflowAction }) => {
      const { teamId, executionId } = event.data as { teamId: string; executionId: string };
      const inputs = workflowAction.inputs ?? {};

      return await step.run(`action-${workflowAction.id}-linear-create`, async () => {
        const db = createAdminClient();
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "linear")
          .single();
        if (!conn) throw new Error("Linear not connected for this team");

        const priority = inputs.priority ? parseInt(String(inputs.priority), 10) : undefined;
        const result = await executeLinearCreateIssue(conn.nango_connection_id, {
          team_id: String(inputs.team_id ?? ""),
          title: String(inputs.title ?? "Untitled"),
          description: inputs.description ? String(inputs.description) : undefined,
          priority: !isNaN(priority!) ? priority : undefined,
          assignee_id: inputs.assignee_id ? String(inputs.assignee_id) : undefined,
        });

        await db.from("execution_steps").insert({
          execution_id: executionId,
          node_id: workflowAction.id,
          step_name: workflowAction.name ?? "Create Linear Issue",
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
    ...actionsDefinition[7], // linear_update_issue
    handler: async ({ event, step, workflowAction }) => {
      const { teamId, executionId } = event.data as { teamId: string; executionId: string };
      const inputs = workflowAction.inputs ?? {};

      return await step.run(`action-${workflowAction.id}-linear-update`, async () => {
        const db = createAdminClient();
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "linear")
          .single();
        if (!conn) throw new Error("Linear not connected for this team");

        const priority = inputs.priority ? parseInt(String(inputs.priority), 10) : undefined;
        const result = await executeLinearUpdateIssue(conn.nango_connection_id, {
          issue_id: String(inputs.issue_id ?? ""),
          title: inputs.title ? String(inputs.title) : undefined,
          description: inputs.description ? String(inputs.description) : undefined,
          state_id: inputs.state_id ? String(inputs.state_id) : undefined,
          priority: !isNaN(priority!) ? priority : undefined,
        });

        await db.from("execution_steps").insert({
          execution_id: executionId,
          node_id: workflowAction.id,
          step_name: workflowAction.name ?? "Update Linear Issue",
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
    ...actionsDefinition[8], // calendly_create_scheduling_link
    handler: async ({ event, step, workflowAction }) => {
      const { teamId, executionId } = event.data as { teamId: string; executionId: string };
      const inputs = workflowAction.inputs ?? {};

      return await step.run(`action-${workflowAction.id}-calendly-schedule`, async () => {
        const db = createAdminClient();
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "calendly")
          .single();
        if (!conn) throw new Error("Calendly not connected for this team");

        const maxCount = inputs.max_event_count ? parseInt(String(inputs.max_event_count), 10) : 1;
        const result = await executeCalendlyCreateSchedulingLink(conn.nango_connection_id, {
          event_type_uri: String(inputs.event_type_uri ?? ""),
          max_event_count: !isNaN(maxCount) ? maxCount : 1,
        });

        await db.from("execution_steps").insert({
          execution_id: executionId,
          node_id: workflowAction.id,
          step_name: workflowAction.name ?? "Create Calendly Scheduling Link",
          status: "completed",
          output_data: result as Record<string, unknown>,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        return result;
      });
    },
  },
  {
    ...actionsDefinition[9], // logic_set_variables
    handler: async ({ event, step, workflowAction }) => {
      const { executionId } = event.data as { executionId: string };
      const inputs = workflowAction.inputs ?? {};
      const raw = inputs.variables_json;

      const result = await step.run(`action-${workflowAction.id}-set-vars`, async () => {
        if (!raw) {
          const variableName = String(inputs.variable_name ?? "").trim();
          if (!variableName) return {};

          const mode = String(inputs.set_mode ?? "value") === "expression" ? "expression" : "value";
          const rawInput = mode === "expression" ? String(inputs.expression ?? "") : String(inputs.value ?? "");
          const trimmed = rawInput.trim();
          const finalValue =
            mode === "expression"
              ? trimmed.startsWith("{{") || trimmed.startsWith("!ref(")
                ? rawInput
                : trimmed
                  ? `{{${trimmed}}}`
                  : ""
              : rawInput;

          return { [variableName]: finalValue };
        }
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          return raw as Record<string, unknown>;
        }

        const json = String(raw).trim();
        if (!json) {
          const variableName = String(inputs.variable_name ?? "").trim();
          if (!variableName) return {};

          const mode = String(inputs.set_mode ?? "value") === "expression" ? "expression" : "value";
          const rawInput = mode === "expression" ? String(inputs.expression ?? "") : String(inputs.value ?? "");
          const trimmed = rawInput.trim();
          const finalValue =
            mode === "expression"
              ? trimmed.startsWith("{{") || trimmed.startsWith("!ref(")
                ? rawInput
                : trimmed
                  ? `{{${trimmed}}}`
                  : ""
              : rawInput;

          return { [variableName]: finalValue };
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch {
          throw new Error("Invalid Variables JSON");
        }

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Variables JSON must be an object");
        }

        return parsed as Record<string, unknown>;
      });

      const db = createAdminClient();
      await db.from("execution_steps").insert({
        execution_id: executionId,
        node_id: workflowAction.id,
        step_name: workflowAction.name ?? "Set Variables",
        status: "completed",
        output_data: result,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

      return result;
    },
  },
];
