import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";

/** Map Nango providerConfigKey back to our internal integration IDs */
const INTERNAL_INTEGRATION_ID: Record<string, string> = {
  "google-mail": "gmail",
  "slack": "slack",
  "google-sheets": "google-sheets",
  "linear": "linear",
  "calendly": "calendly",
};

/**
 * Nango auth webhook — receives a POST when a user successfully connects an integration.
 * Payload shape: { type, operation, success, connectionId, providerConfigKey, endUser: { id }, organization: { id } }
 * We store the connectionId mapped to the team.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Only handle successful new-connection events
    if (body.type !== "auth" || !body.success) {
      return Response.json({ ok: true });
    }

    const connectionId: string = body.connectionId;
    const nangoIntegrationId: string = body.providerConfigKey;
    const integrationId: string = INTERNAL_INTEGRATION_ID[nangoIntegrationId] ?? nangoIntegrationId;
    // Support both new shape (endUser/organization) and legacy (tags)
    const teamId: string = body.organization?.id ?? body.tags?.organization_id;
    const userId: string = body.endUser?.id ?? body.tags?.end_user_id;

    if (!connectionId || !integrationId || !teamId) {
      console.warn("Nango webhook missing required fields", { connectionId, integrationId, teamId });
      return Response.json({ ok: true });
    }

    const db = createAdminClient();

    await db
      .from("nango_connections")
      .upsert(
        {
          team_id: teamId,
          integration_id: integrationId,
          nango_connection_id: connectionId,
          connected_by: userId ?? null,
        },
        { onConflict: "team_id,integration_id" }
      );

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Nango webhook error:", err);
    // Always return 200 to Nango so it doesn't retry indefinitely
    return Response.json({ ok: true });
  }
}
