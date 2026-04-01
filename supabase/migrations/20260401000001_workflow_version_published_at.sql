-- Track which workflow versions have been published
alter table public.workflow_versions
  add column if not exists published_at timestamptz;

create index if not exists idx_workflow_versions_published
  on public.workflow_versions(workflow_id, published_at)
  where published_at is not null;
