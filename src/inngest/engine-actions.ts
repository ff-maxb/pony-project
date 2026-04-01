import type { EngineAction } from "@inngest/workflow-kit";
import * as jsonLogic from "json-logic-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createExecutionLogger } from "@/lib/execution-logger";
import {
  executeSlackSendMessage,
  executeGmailSendEmail,
  executeGoogleSheetsAppendRow,
  executeHttpRequest,
  executeLinearCreateIssue,
  executeLinearUpdateIssue,
  executeCalendlyCreateSchedulingLink,
  executeSendGridSendEmail,
  executeTwilioSendSms,
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
        const db = createAdminClient();
        const log = createExecutionLogger(executionId);
        const conditionRaw = workflowAction.inputs?.condition;
        // Treat missing / null / non-string condition as "always true"
        const conditionStr =
          conditionRaw == null || conditionRaw === "undefined"
            ? ""
            : String(conditionRaw).trim();

        log.info(`Evaluating condition`, { nodeId: workflowAction.id, conditionStr });

        if (!conditionStr) {
          log.info(`No condition set — defaulting to true`, { nodeId: workflowAction.id });
          await db.from("execution_steps").insert({
            execution_id: executionId,
            node_id: workflowAction.id,
            step_name: workflowAction.name ?? "If / Condition",
            status: "completed",
            output_data: { result: true, note: "no condition set" },
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          });
          return { result: true };
        }

        const vars = (workflowAction.inputs?._vars ?? {}) as Record<string, unknown>;
        log.info(`Condition vars`, { nodeId: workflowAction.id, vars });

        // Transform !ref($.path) strings → json-logic {"var": "path"} references
        const transformRefs = (obj: unknown): unknown => {
          if (typeof obj === "string") {
            const m = obj.match(/^!ref\(\$\.(.+)\)$/);
            if (m) return { var: m[1] };
            return obj;
          }
          if (Array.isArray(obj)) return obj.map(transformRefs);
          if (obj && typeof obj === "object") {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
              out[k] = transformRefs(v);
            }
            return out;
          }
          return obj;
        };

        let raw: unknown;
        try {
          raw = JSON.parse(conditionStr);
        } catch (parseErr) {
          const msg = `Invalid condition JSON: ${conditionStr}`;
          log.error(msg, { nodeId: workflowAction.id, parseError: String(parseErr) });
          throw new Error(msg);
        }

        const logic = transformRefs(raw) as Parameters<typeof jsonLogic.apply>[0];
        const evalResult = jsonLogic.apply(logic, { vars });
        const stepResult = { result: !!evalResult };
        log.info(`Condition result`, { nodeId: workflowAction.id, logic, evalResult, result: stepResult.result });

        await db.from("execution_steps").insert({
          execution_id: executionId,
          node_id: workflowAction.id,
          step_name: workflowAction.name ?? "If / Condition",
          status: "completed",
          output_data: stepResult,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        return stepResult;
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
  {
    ...actionsDefinition[10], // sendgrid_send_email
    handler: async ({ event, step, workflowAction }) => {
      const { executionId } = event.data as { executionId: string };
      const inputs = workflowAction.inputs ?? {};

      return await step.run(`action-${workflowAction.id}-sendgrid`, async () => {
        const result = await executeSendGridSendEmail({
          to: String(inputs.to ?? ""),
          from: String(inputs.from ?? ""),
          subject: String(inputs.subject ?? ""),
          body: String(inputs.body ?? ""),
        });

        const db = createAdminClient();
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
    ...actionsDefinition[11], // twilio_send_sms
    handler: async ({ event, step, workflowAction }) => {
      const { executionId } = event.data as { executionId: string };
      const inputs = workflowAction.inputs ?? {};

      return await step.run(`action-${workflowAction.id}-twilio`, async () => {
        const result = await executeTwilioSendSms({
          to: String(inputs.to ?? ""),
          from: String(inputs.from ?? ""),
          message: String(inputs.message ?? ""),
        });

        const db = createAdminClient();
        await db.from("execution_steps").insert({
          execution_id: executionId,
          node_id: workflowAction.id,
          step_name: workflowAction.name ?? "Send SMS",
          status: "completed",
          output_data: result,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        return result;
      });
    },
  },
];
