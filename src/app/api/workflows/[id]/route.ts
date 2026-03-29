import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, db } = await getAuthContext();
    const { id: workflowId } = await params;

    const { data: workflow, error } = await db
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .is("deleted_at", null)
      .single();

    if (error || !workflow) return errorResponse("Workflow not found", 404);
    await verifyTeamMembership(userId, workflow.team_id);

    // Get latest version
    const { data: version } = await db
      .from("workflow_versions")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    return jsonResponse({ ...workflow, latest_version: version });
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}

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
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.trigger_type !== undefined) updates.trigger_type = body.trigger_type;
    if (body.trigger_config !== undefined) updates.trigger_config = body.trigger_config;

    const { data, error } = await db
      .from("workflows")
      .update(updates)
      .eq("id", workflowId)
      .select()
      .single();

    if (error) return errorResponse(error.message, 500);
    return jsonResponse(data);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}

export async function DELETE(
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

    // Soft delete
    const { error } = await db
      .from("workflows")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", workflowId);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ deleted: true });
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}
