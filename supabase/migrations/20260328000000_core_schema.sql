-- Core schema for workflow automation builder

-- Teams
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Team members (Clerk user IDs)
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id text not null, -- Clerk user ID
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index idx_team_members_user on public.team_members(user_id);
create index idx_team_members_team on public.team_members(team_id);

-- Workflows
create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  trigger_type text not null default 'manual' check (trigger_type in ('manual', 'webhook', 'cron', 'event')),
  trigger_config jsonb not null default '{}'::jsonb,
  created_by text not null, -- Clerk user ID
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_workflows_team on public.workflows(team_id);
create index idx_workflows_status on public.workflows(status) where deleted_at is null;

-- Workflow versions (stores the React Flow definition JSON)
create table public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  version_number integer not null,
  definition jsonb not null default '{}'::jsonb, -- { nodes: [], edges: [] }
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (workflow_id, version_number)
);

create index idx_workflow_versions_workflow on public.workflow_versions(workflow_id);

-- Workflow executions
create table public.workflow_executions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  workflow_version_id uuid not null references public.workflow_versions(id),
  status text not null default 'running' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  trigger_data jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text
);

create index idx_executions_workflow on public.workflow_executions(workflow_id);
create index idx_executions_status on public.workflow_executions(status);

-- Execution steps (per-node execution records)
create table public.execution_steps (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.workflow_executions(id) on delete cascade,
  node_id text not null, -- React Flow node ID
  step_name text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'skipped')),
  input_data jsonb,
  output_data jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz
);

create index idx_execution_steps_execution on public.execution_steps(execution_id);

-- Nango connections (team-scoped integration connections)
create table public.nango_connections (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  integration_id text not null, -- e.g. 'slack', 'gmail', 'google-sheets'
  nango_connection_id text not null,
  created_at timestamptz not null default now(),
  unique (team_id, integration_id)
);

create index idx_nango_connections_team on public.nango_connections(team_id);

-- Enable RLS on all tables
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_versions enable row level security;
alter table public.workflow_executions enable row level security;
alter table public.execution_steps enable row level security;
alter table public.nango_connections enable row level security;

-- RLS policies: team_members is the authority for access
-- Users can see teams they belong to
create policy "users can view own teams"
  on public.teams for select
  using (id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub'));

-- Users can manage team_members for their teams
create policy "users can view team members"
  on public.team_members for select
  using (team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub'));

-- Workflows: team-scoped
create policy "team members can view workflows"
  on public.workflows for select
  using (team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub'));

create policy "team members can insert workflows"
  on public.workflows for insert
  with check (team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub'));

create policy "team members can update workflows"
  on public.workflows for update
  using (team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub'));

-- Workflow versions: team-scoped via workflow
create policy "team members can view versions"
  on public.workflow_versions for select
  using (workflow_id in (select id from public.workflows where team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub')));

create policy "team members can insert versions"
  on public.workflow_versions for insert
  with check (workflow_id in (select id from public.workflows where team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub')));

-- Executions: team-scoped via workflow
create policy "team members can view executions"
  on public.workflow_executions for select
  using (workflow_id in (select id from public.workflows where team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub')));

create policy "team members can insert executions"
  on public.workflow_executions for insert
  with check (workflow_id in (select id from public.workflows where team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub')));

create policy "team members can update executions"
  on public.workflow_executions for update
  using (workflow_id in (select id from public.workflows where team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub')));

-- Execution steps: team-scoped via execution > workflow
create policy "team members can view execution steps"
  on public.execution_steps for select
  using (execution_id in (select id from public.workflow_executions where workflow_id in (select id from public.workflows where team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub'))));

create policy "team members can insert execution steps"
  on public.execution_steps for insert
  with check (execution_id in (select id from public.workflow_executions where workflow_id in (select id from public.workflows where team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub'))));

create policy "team members can update execution steps"
  on public.execution_steps for update
  using (execution_id in (select id from public.workflow_executions where workflow_id in (select id from public.workflows where team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub'))));

-- Nango connections: team-scoped
create policy "team members can view connections"
  on public.nango_connections for select
  using (team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub'));

create policy "team members can insert connections"
  on public.nango_connections for insert
  with check (team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub'));

create policy "team members can delete connections"
  on public.nango_connections for delete
  using (team_id in (select team_id from public.team_members where user_id = auth.jwt() ->> 'sub'));

-- Function to auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workflows_updated_at
  before update on public.workflows
  for each row execute function public.handle_updated_at();
