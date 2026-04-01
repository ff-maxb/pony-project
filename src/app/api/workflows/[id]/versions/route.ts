import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";

/** List all versions for a workflow */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, db } = await getAuthContext();
    const { id: workflowId } = await params;

    const { data: workflow } = await db
      .from("workflows")
      .select("team_id")
      .eq("id", workflowId)
      .is("deleted_at", null)
      .single();
    if (!workflow) return errorResponse("Workflow not found", 404);
    await verifyTeamMembership(userId, workflow.team_id);

    const { data, error } = await db
      .from("workflow_versions")
      .select("id, workflow_id, version_number, created_by, created_at, published_at")
      .eq("workflow_id", workflowId)
      .not("published_at", "is", null)
      .order("version_number", { ascending: false });

    if (error) return errorResponse(error.message, 500);
    return jsonResponse(data ?? []);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}
