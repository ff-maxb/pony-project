import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { inngest } from "@/inngest/client";

/** Get execution detail with steps */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, db } = await getAuthContext();
    const { id: executionId } = await params;

    const { data: execution, error } = await db
      .from("workflow_executions")
      .select("*, workflows(team_id)")
      .eq("id", executionId)
      .single();
    if (error || !execution) return errorResponse("Execution not found", 404);

    const teamId = (execution.workflows as { team_id: string })?.team_id;
    if (!teamId) return errorResponse("Execution not found", 404);
    await verifyTeamMembership(userId, teamId);

    // Get execution steps
    const { data: steps } = await db
      .from("execution_steps")
      .select("*")
      .eq("execution_id", executionId)
      .order("started_at", { ascending: true });

    // Get execution logs
    const { data: logs } = await db
      .from("execution_logs")
      .select("id, level, message, data, created_at")
      .eq("execution_id", executionId)
      .order("created_at", { ascending: true });

    // Get workflow version definition for rendering
    const { data: version } = await db
      .from("workflow_versions")
      .select("definition, version_number")
      .eq("id", execution.workflow_version_id)
      .single();

    return jsonResponse({
      ...execution,
      steps: steps ?? [],
      logs: logs ?? [],
      version,
    });
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}

/** Cancel a running execution */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, db } = await getAuthContext();
    const { id: executionId } = await params;

    const { data: execution } = await db
      .from("workflow_executions")
      .select("*, workflows(team_id)")
      .eq("id", executionId)
      .single();
    if (!execution) return errorResponse("Execution not found", 404);

    const teamId = (execution.workflows as { team_id: string })?.team_id;
    if (!teamId) return errorResponse("Execution not found", 404);
    await verifyTeamMembership(userId, teamId);

    if (execution.status !== "running" && execution.status !== "pending") {
      return errorResponse("Execution is not running", 400);
    }

    // Send cancellation event to Inngest
    await inngest.send({
      name: "workflow/execution.cancelled",
      data: { executionId },
    });

    // Update status
    await db
      .from("workflow_executions")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", executionId);

    return jsonResponse({ cancelled: true });
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}
