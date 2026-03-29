import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, db } = await getAuthContext();
    const { id: teamId } = await params;
    await verifyTeamMembership(userId, teamId);

    const { data, error } = await db
      .from("team_members")
      .select("id, user_id, role, created_at")
      .eq("team_id", teamId);
    if (error) return errorResponse(error.message, 500);
    return jsonResponse(data);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, db } = await getAuthContext();
    const { id: teamId } = await params;
    const membership = await verifyTeamMembership(userId, teamId);

    if (membership.role === "member") {
      return errorResponse("Only owners and admins can invite members", 403);
    }

    const body = await request.json();
    const { user_id: inviteUserId, role = "member" } = body;
    if (!inviteUserId) return errorResponse("user_id is required");
    if (!["admin", "member"].includes(role)) return errorResponse("Invalid role");

    const { data, error } = await db
      .from("team_members")
      .insert({ team_id: teamId, user_id: inviteUserId, role })
      .select()
      .single();
    if (error) return errorResponse(error.message, 500);
    return jsonResponse(data, 201);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}
