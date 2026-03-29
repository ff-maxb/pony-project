import { NextRequest } from "next/server";

/**
 * OAuth callback relay — redirects to Nango's callback endpoint, passing all query params.
 * Register https://yourdomain.com/oauth-callback as the OAuth callback URL with API providers.
 * Set this URL in Nango Environment Settings > Callback URL.
 */
export async function GET(request: NextRequest) {
  const target = new URL("https://api.nango.dev/oauth/callback");
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });
  return Response.redirect(target.toString(), 308);
}
