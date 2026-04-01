-- Per-execution log entries for workflow runs
create table public.execution_logs (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.workflow_executions(id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  data jsonb,
  created_at timestamptz not null default now()
);

create index idx_execution_logs_execution on public.execution_logs(execution_id, created_at);
