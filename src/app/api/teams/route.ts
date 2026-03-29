import { getAuthContext, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { seedDemoWorkflows } from "@/lib/demo-workflows";

export async function GET() {
  try {
    const { userId, db } = await getAuthContext();
    const { data, error } = await db
      .from("team_members")
      .select("team_id, role, teams(id, name, created_at)")
      .eq("user_id", userId);

    if (error) return errorResponse(error.message, 500);
    const teams = (data ?? []).map((m) => ({
      ...(m.teams as unknown as { id: string; name: string; created_at: string }),
      role: m.role,
    }));
    return jsonResponse(teams);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return errorResponse(msg, msg === "Unauthorized" ? 401 : 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, db } = await getAuthContext();
    const body = await request.json();
    const name = body.name?.trim();
    if (!name) return errorResponse("Team name is required");

    // Create team
    const { data: team, error: teamError } = await db
      .from("teams")
      .insert({ name })
      .select()
      .single();
    if (teamError || !team) return errorResponse(teamError?.message ?? "Failed to create team", 500);

    // Add creator as owner
    const { error: memberError } = await db
      .from("team_members")
      .insert({ team_id: team.id, user_id: userId, role: "owner" });
    if (memberError) return errorResponse(memberError.message, 500);

    // Seed demo workflows for new teams (fire-and-forget)
    seedDemoWorkflows(db, team.id, userId).catch(() => {});

    return jsonResponse(team, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return errorResponse(msg, msg === "Unauthorized" ? 401 : 500);
  }
}
