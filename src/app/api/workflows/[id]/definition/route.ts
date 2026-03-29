import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";

/** Save a new workflow version (definition) */
export async function PUT(
  request: NextRequest,
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

    const body = await request.json();
    const { definition } = body;
    if (!definition || !Array.isArray(definition.actions) || !Array.isArray(definition.edges)) {
      return errorResponse("definition with actions and edges is required");
    }

    // Get current max version
    const { data: latestVersion } = await db
      .from("workflow_versions")
      .select("version_number")
      .eq("workflow_id", workflowId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (latestVersion?.version_number ?? 0) + 1;

    const { data: version, error } = await db
      .from("workflow_versions")
      .insert({
        workflow_id: workflowId,
        version_number: nextVersion,
        definition,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return errorResponse(error.message, 500);
    return jsonResponse(version, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(msg, msg === "Unauthorized" || msg === "Not a member of this team" ? 401 : 500);
  }
}
