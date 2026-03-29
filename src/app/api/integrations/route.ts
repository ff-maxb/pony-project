import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { AVAILABLE_INTEGRATIONS } from "@/types/workflow";

/** List available integrations */
export async function GET(request: NextRequest) {
  try {
    await getAuthContext();
    const teamId = request.nextUrl.searchParams.get("teamId");

    if (!teamId) {
      // Return available integrations catalog
      return jsonResponse(AVAILABLE_INTEGRATIONS);
    }

    // Return team's connected integrations
    const { userId, db } = await getAuthContext();
    await verifyTeamMembership(userId, teamId);

    const { data, error } = await db
      .from("nango_connections")
      .select("*")
      .eq("team_id", teamId);

    if (error) return errorResponse(error.message, 500);

    // Merge with catalog info
    const connections = (data ?? []).map((conn) => ({
      ...conn,
      integration: AVAILABLE_INTEGRATIONS.find((i) => i.id === conn.integration_id),
    }));

    return jsonResponse(connections);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}

/** Save a new Nango connection */
export async function POST(request: NextRequest) {
  try {
    const { userId, db } = await getAuthContext();
    const body = await request.json();
    const { teamId, integrationId, nangoConnectionId } = body;

    if (!teamId || !integrationId || !nangoConnectionId) {
      return errorResponse("teamId, integrationId, and nangoConnectionId are required");
    }

    await verifyTeamMembership(userId, teamId);

    const { data, error } = await db
      .from("nango_connections")
      .upsert(
        {
          team_id: teamId,
          integration_id: integrationId,
          nango_connection_id: nangoConnectionId,
        },
        { onConflict: "team_id,integration_id" }
      )
      .select()
      .single();

    if (error) return errorResponse(error.message, 500);
    return jsonResponse(data, 201);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}

/** Delete a Nango connection */
export async function DELETE(request: NextRequest) {
  try {
    const { userId, db } = await getAuthContext();
    const connectionId = request.nextUrl.searchParams.get("connectionId");
    const teamId = request.nextUrl.searchParams.get("teamId");

    if (!connectionId || !teamId) {
      return errorResponse("connectionId and teamId are required");
    }

    await verifyTeamMembership(userId, teamId);

    const { error } = await db
      .from("nango_connections")
      .delete()
      .eq("id", connectionId)
      .eq("team_id", teamId);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ deleted: true });
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}
