// Run: node scripts/add-published-at.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ejitdyeyqatifmbpdppy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqaXRkeWV5cWF0aWZtYnBkcHB5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDc0MTczOCwiZXhwIjoyMDkwMzE3NzM4fQ.u4j5G9Vi17od5Fmln3k8TfmmObA9xfvtDurdRtiCbmo"
);

const sql = `
  alter table public.workflow_versions
    add column if not exists published_at timestamptz;

  create index if not exists idx_workflow_versions_published
    on public.workflow_versions(workflow_id, published_at)
    where published_at is not null;
`;

const { error } = await supabase.rpc("exec_ddl", { sql });

if (error) {
  console.log("RPC error (expected if exec_ddl not available):", error.message);

  // Verify by selecting the column
  const { data, error: selectErr } = await supabase
    .from("workflow_versions")
    .select("id, published_at")
    .limit(1);

  if (!selectErr) {
    console.log("✓ published_at column already exists on workflow_versions");
  } else {
    console.error("Column does not exist yet:", selectErr.message);
    console.log("\nPlease run this SQL in the Supabase SQL editor:");
    console.log(sql);
  }
} else {
  console.log("✓ Migration applied: workflow_versions.published_at added");
}
