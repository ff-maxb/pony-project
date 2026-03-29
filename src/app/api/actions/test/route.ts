import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";
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

/** Test a single workflow action with the given inputs */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const body = await request.json();
    const { workflowId, kind, inputs } = body as {
      workflowId: string;
      kind: string;
      inputs: Record<string, unknown>;
    };

    if (!workflowId || !kind) {
      return errorResponse("workflowId and kind are required", 400);
    }

    const db = createAdminClient();
    const { data: workflow } = await db
      .from("workflows")
      .select("team_id")
      .eq("id", workflowId)
      .single();
    if (!workflow) return errorResponse("Workflow not found", 404);

    await verifyTeamMembership(userId, workflow.team_id);
    const teamId = workflow.team_id;

    let result: unknown;

    switch (kind) {
      case "slack_send_message": {
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "slack")
          .single();
        if (!conn) return errorResponse("Slack not connected for this team", 400);
        result = await executeSlackSendMessage(conn.nango_connection_id, {
          channel: String(inputs.channel ?? ""),
          message: String(inputs.message ?? ""),
        });
        break;
      }
      case "gmail_send_email": {
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "gmail")
          .single();
        if (!conn) return errorResponse("Gmail not connected for this team", 400);
        result = await executeGmailSendEmail(conn.nango_connection_id, {
          to: String(inputs.to ?? ""),
          subject: String(inputs.subject ?? ""),
          body: String(inputs.body ?? ""),
        });
        break;
      }
      case "google_sheets_append_row": {
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "google-sheets")
          .single();
        if (!conn) return errorResponse("Google Sheets not connected for this team", 400);
        const valuesRaw = String(inputs.values ?? "");
        const values = valuesRaw.split(",").map((v) => v.trim());
        result = await executeGoogleSheetsAppendRow(conn.nango_connection_id, {
          spreadsheet_id: String(inputs.spreadsheet_id ?? ""),
          sheet_name: String(inputs.sheet_name ?? "Sheet1"),
          values,
        });
        break;
      }
      case "http_request": {
        result = await executeHttpRequest({
          url: String(inputs.url ?? ""),
          method: String(inputs.method ?? "GET"),
          body: inputs.body ? String(inputs.body) : undefined,
        });
        break;
      }
      case "linear_create_issue": {
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "linear")
          .single();
        if (!conn) return errorResponse("Linear not connected for this team", 400);
        const priority = inputs.priority ? parseInt(String(inputs.priority), 10) : undefined;
        result = await executeLinearCreateIssue(conn.nango_connection_id, {
          team_id: String(inputs.team_id ?? ""),
          title: String(inputs.title ?? "Untitled"),
          description: inputs.description ? String(inputs.description) : undefined,
          priority: priority !== undefined && !isNaN(priority) ? priority : undefined,
          assignee_id: inputs.assignee_id ? String(inputs.assignee_id) : undefined,
        });
        break;
      }
      case "linear_update_issue": {
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "linear")
          .single();
        if (!conn) return errorResponse("Linear not connected for this team", 400);
        const priority = inputs.priority ? parseInt(String(inputs.priority), 10) : undefined;
        result = await executeLinearUpdateIssue(conn.nango_connection_id, {
          issue_id: String(inputs.issue_id ?? ""),
          title: inputs.title ? String(inputs.title) : undefined,
          description: inputs.description ? String(inputs.description) : undefined,
          state_id: inputs.state_id ? String(inputs.state_id) : undefined,
          priority: priority !== undefined && !isNaN(priority) ? priority : undefined,
        });
        break;
      }
      case "calendly_create_scheduling_link": {
        const { data: conn } = await db
          .from("nango_connections")
          .select("nango_connection_id")
          .eq("team_id", teamId)
          .eq("integration_id", "calendly")
          .single();
        if (!conn) return errorResponse("Calendly not connected for this team", 400);
        const maxCount = inputs.max_event_count ? parseInt(String(inputs.max_event_count), 10) : 1;
        result = await executeCalendlyCreateSchedulingLink(conn.nango_connection_id, {
          event_type_uri: String(inputs.event_type_uri ?? ""),
          max_event_count: !isNaN(maxCount) ? maxCount : 1,
        });
        break;
      }
      case "logic_set_variables": {
        const raw = inputs.variables_json;
        if (!raw) {
          const variableName = String(inputs.variable_name ?? "").trim();
          if (!variableName) {
            result = {};
            break;
          }

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

          result = { [variableName]: finalValue };
          break;
        }

        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          result = raw;
          break;
        }

        const json = String(raw).trim();
        if (!json) {
          result = {};
          break;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch {
          return errorResponse("Invalid Variables JSON", 400);
        }

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return errorResponse("Variables JSON must be an object", 400);
        }

        result = parsed;
        break;
      }
      default:
        return errorResponse(`Unknown action kind: ${kind}`, 400);
    }

    return jsonResponse({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500);
  }
}
