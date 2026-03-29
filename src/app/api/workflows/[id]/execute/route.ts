import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { inngest } from "@/inngest/client";

/** Manually trigger a workflow execution */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, db } = await getAuthContext();
    const { id: workflowId } = await params;

    const { data: workflow } = await db
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .is("deleted_at", null)
      .single();
    if (!workflow) return errorResponse("Workflow not found", 404);
    await verifyTeamMembership(userId, workflow.team_id);

    if (workflow.status === "paused") {
      return errorResponse("Workflow is paused", 400);
    }

    if (!process.env.INNGEST_EVENT_KEY) {
      return errorResponse("INNGEST_EVENT_KEY is not configured", 503);
    }

    // Get latest version
    const { data: version } = await db
      .from("workflow_versions")
      .select("id")
      .eq("workflow_id", workflowId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();
    if (!version) return errorResponse("No workflow version found", 400);

    // Parse optional trigger data from request body
    let triggerData: Record<string, unknown> = { source: "manual", triggered_by: userId };
    try {
      const body = await request.json();
      if (body.triggerData) {
        triggerData = { ...triggerData, ...body.triggerData };
      }
    } catch {
      // No body is fine
    }

    // Create execution record
    const { data: execution, error } = await db
      .from("workflow_executions")
      .insert({
        workflow_id: workflowId,
        workflow_version_id: version.id,
        status: "pending",
        trigger_data: triggerData,
      })
      .select("id")
      .single();
    if (error || !execution) return errorResponse(error?.message ?? "Failed to create execution", 500);

    try {
      await inngest.send({
        name: "workflow/execution.requested",
        data: {
          workflowId,
          versionId: version.id,
          executionId: execution.id,
          teamId: workflow.team_id,
          triggerData,
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await db
        .from("workflow_executions")
        .update({ status: "failed", completed_at: new Date().toISOString(), error: errorMsg })
        .eq("id", execution.id);
      throw err;
    }

    return jsonResponse({ executionId: execution.id }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse("Unauthorized", 401);
    if (msg === "Not a member of this team") return errorResponse("Forbidden", 403);
    console.error("Execute workflow error:", err);
    return errorResponse(msg || "Internal server error", 500);
  }
}
