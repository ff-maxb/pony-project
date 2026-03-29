import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";

/** List executions for a workflow */
export async function GET(
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

    const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10);

    const { data, error } = await db
      .from("workflow_executions")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse(data);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}
