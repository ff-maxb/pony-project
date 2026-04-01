-- Track which version is currently live/active for a workflow
alter table public.workflows
  add column if not exists current_version_id uuid references public.workflow_versions(id);
