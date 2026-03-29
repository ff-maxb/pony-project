import { getAuthContext, verifyTeamMembership, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { fetchLinearTeams } from "@/lib/integrations/actions";

/** Return the list of Linear teams for the connected account */
export async function GET(request: NextRequest) {
  try {
    const { userId, db } = await getAuthContext();
    const teamId = request.nextUrl.searchParams.get("teamId");
    if (!teamId) return errorResponse("teamId is required");

    await verifyTeamMembership(userId, teamId);

    const { data: conn } = await db
      .from("nango_connections")
      .select("nango_connection_id")
      .eq("team_id", teamId)
      .eq("integration_id", "linear")
      .single();

    if (!conn) return errorResponse("Linear not connected for this team", 400);

    const teams = await fetchLinearTeams(conn.nango_connection_id);
    return jsonResponse(teams);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[linear/teams]", msg);
    return errorResponse(msg, msg === "Unauthorized" ? 401 : 500);
  }
}
