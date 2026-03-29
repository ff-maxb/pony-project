import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { userId, db } = await getAuthContext();
    const teamId = request.nextUrl.searchParams.get("teamId");
    if (!teamId) return errorResponse("teamId query param required");

    await verifyTeamMembership(userId, teamId);

    const { data, error } = await db
      .from("workflows")
      .select("*")
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (error) return errorResponse(error.message, 500);
    return jsonResponse(data);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, db } = await getAuthContext();
    const body = await request.json();
    const { teamId, name, description, trigger_type = "manual", trigger_config = {} } = body;

    if (!teamId || !name?.trim()) {
      return errorResponse("teamId and name are required");
    }

    await verifyTeamMembership(userId, teamId);

    const { data: workflow, error } = await db
      .from("workflows")
      .insert({
        team_id: teamId,
        name: name.trim(),
        description,
        trigger_type,
        trigger_config,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return errorResponse(error.message, 500);

    // Create initial version with empty definition
    await db.from("workflow_versions").insert({
      workflow_id: workflow.id,
      version_number: 1,
      definition: { nodes: [], edges: [] },
      created_by: userId,
    });

    return jsonResponse(workflow, 201);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}
