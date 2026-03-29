import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Get the authenticated Clerk user ID and verify team membership.
 * Returns the userId and supabase admin client.
 * Throws if not authenticated.
 */
export async function getAuthContext() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  // createAdminClient throws if SUPABASE_SERVICE_ROLE_KEY is missing —
  // let that error propagate as a 500, not a 401.
  const db = createAdminClient();
  return { userId, db };
}

/**
 * Verify user is a member of the given team. Returns the membership record.
 */
export async function verifyTeamMembership(userId: string, teamId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();
  if (error || !data) {
    throw new Error("Not a member of this team");
  }
  return data;
}

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
