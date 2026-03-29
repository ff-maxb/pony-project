import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client that bypasses RLS.
 * Used by server-side operations (Inngest functions, API routes with Clerk auth).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL");
  }
  return createClient(url, key);
}
