import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";

/**
 * POST /api/workflows/[id]/versions/[versionId]/rollback
 * Moves the current_version pointer to the specified version (no new row created).
 * Returns the target version.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { userId, db } = await getAuthContext();
    const { id: workflowId, versionId } = await params;

    const { data: workflow } = await db
      .from("workflows")
      .select("team_id")
      .eq("id", workflowId)
      .is("deleted_at", null)
      .single();
    if (!workflow) return errorResponse("Workflow not found", 404);
    await verifyTeamMembership(userId, workflow.team_id);

    // Verify target version exists and belongs to this workflow
    const { data: targetVersion } = await db
      .from("workflow_versions")
      .select("id")
      .eq("id", versionId)
      .eq("workflow_id", workflowId)
      .single();
    if (!targetVersion) return errorResponse("Version not found", 404);

    const now = new Date().toISOString();

    // Stamp published_at on the target version if not already set
    await db
      .from("workflow_versions")
      .update({ published_at: now })
      .eq("id", versionId)
      .is("published_at", null);

    // Fetch the (possibly just-updated) target version to return
    const { data: rolledBackVersion, error } = await db
      .from("workflow_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    if (error || !rolledBackVersion) return errorResponse("Version not found", 404);

    // Move the current_version pointer and ensure workflow is active
    await db
      .from("workflows")
      .update({ status: "active", current_version_id: versionId })
      .eq("id", workflowId);

    return jsonResponse(rolledBackVersion, 200);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}
