// Run: node scripts/add-published-at-v2.mjs
import { execSync } from "child_process";

const projectRef = "ejitdyeyqatifmbpdppy";

let token = "";
try {
  token = execSync("cat ~/.config/supabase/access-token 2>/dev/null || cat ~/.supabase/access-token 2>/dev/null").toString().trim();
} catch {}

const sql = "alter table public.workflow_versions add column if not exists published_at timestamptz;";

if (!token) {
  console.log("No Supabase access token found.");
  console.log("\nPlease run this SQL in the Supabase SQL Editor:");
  console.log("https://supabase.com/dashboard/project/" + projectRef + "/sql/new");
  console.log("\n" + sql);
  process.exit(0);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});

const body = await res.text();
if (res.ok) {
  console.log("✓ Migration applied: workflow_versions.published_at added");
} else {
  console.log("Management API failed:", res.status, body);
  console.log("\nPlease run this SQL in the Supabase SQL Editor:");
  console.log("https://supabase.com/dashboard/project/" + projectRef + "/sql/new");
  console.log("\n" + sql);
}
