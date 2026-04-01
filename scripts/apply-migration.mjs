// Run: node scripts/apply-migration.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ejitdyeyqatifmbpdppy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqaXRkeWV5cWF0aWZtYnBkcHB5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDc0MTczOCwiZXhwIjoyMDkwMzE3NzM4fQ.u4j5G9Vi17od5Fmln3k8TfmmObA9xfvtDurdRtiCbmo"
);

const { error } = await supabase.rpc("exec_ddl", {
  sql: `
    create table if not exists public.execution_logs (
      id uuid primary key default gen_random_uuid(),
      execution_id uuid not null references public.workflow_executions(id) on delete cascade,
      level text not null default 'info' check (level in ('info', 'warn', 'error')),
      message text not null,
      data jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_execution_logs_execution
      on public.execution_logs(execution_id, created_at);
  `,
});

if (error) {
  // Table may already exist or exec_ddl not available — try direct insert to test connectivity
  console.log("RPC error (expected if exec_ddl not available):", error.message);

  // Verify table existence by selecting from it
  const { error: selectErr } = await supabase.from("execution_logs").select("id").limit(1);
  if (!selectErr) {
    console.log("✓ execution_logs table already exists");
  } else {
    console.error("Table does not exist yet:", selectErr.message);
    console.log("\nPlease run this SQL in the Supabase SQL editor:");
    console.log(`
create table if not exists public.execution_logs (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.workflow_executions(id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_execution_logs_execution
  on public.execution_logs(execution_id, created_at);
    `);
  }
} else {
  console.log("✓ Migration applied successfully");
}
