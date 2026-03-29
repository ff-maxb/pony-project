import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  executeSlackSendMessage,
  executeGmailSendEmail,
  executeGoogleSheetsAppendRow,
  executeHttpRequest,
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
      default:
        return errorResponse(`Unknown action kind: ${kind}`, 400);
    }

    return jsonResponse({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500);
  }
}
