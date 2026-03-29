import { Nango } from "@nangohq/node";
import { auth } from "@clerk/nextjs/server";
import { getAuthContext, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";

/**
 * Map our internal integration IDs to Nango's provider config keys.
 * The Nango integration ID is the "unique key" set when creating the integration in the Nango dashboard.
 */
const NANGO_INTEGRATION_ID: Record<string, string> = {
  gmail: "google-mail",
  slack: "slack",
  "google-sheets": "google-sheets",
  linear: "linear",
  calendly: "calendly",
};

/**
 * Scopes to request per integration.
 * Nango passes these as authorization_params overrides when opening OAuth.
 */
const INTEGRATION_SCOPES: Record<string, string> = {
  linear: "read,write",
};

/**
 * Generate a Nango Connect session token.
 * The frontend calls this before opening the Nango Connect UI.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();

    if (!process.env.NANGO_SECRET_KEY) {
      return errorResponse("NANGO_SECRET_KEY is not configured", 503);
    }

    const body = await request.json();
    const { teamId, integrationId } = body as { teamId?: string; integrationId?: string };

    if (!teamId) return errorResponse("teamId is required");

    // Grab email from Clerk session claims for tagging
    const { sessionClaims } = await auth();
    const email = (sessionClaims?.email as string | undefined) ?? undefined;

    const nango = new Nango({ secretKey: process.env.NANGO_SECRET_KEY });

    const nangoIntegrationId = integrationId ? NANGO_INTEGRATION_ID[integrationId] : undefined;
    const scopeOverride = integrationId ? INTEGRATION_SCOPES[integrationId] : undefined;

    const result = await nango.createConnectSession({
      end_user: {
        id: userId,
        ...(email ? { email } : {}),
      },
      organization: { id: teamId },
      ...(nangoIntegrationId ? { allowed_integrations: [nangoIntegrationId] } : {}),
      ...(nangoIntegrationId && scopeOverride ? {
        integrations_config_defaults: {
          [nangoIntegrationId]: {
            connection_config: { oauth_scopes_override: scopeOverride },
          },
        },
      } : {}),
    });

    return jsonResponse({ sessionToken: result.data.token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse("Unauthorized", 401);
    console.error("Nango session token error:", err);
    return errorResponse(msg || "Failed to create session token", 500);
  }
}
