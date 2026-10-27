-- Shared official FIRST cache plus per-workspace event selection. No scouting rows are changed.
create table if not exists public.first_api_cache (
  cache_key text primary key,
  season integer not null check (season between 2023 and 9999),
  event_code text,
  tournament_level text check (tournament_level is null or tournament_level in ('qual','playoff')),
  payload jsonb not null,
  last_modified text,
  synced_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.first_api_cache enable row level security;
revoke all on public.first_api_cache from anon, authenticated;
grant all on public.first_api_cache to service_role;

create table if not exists public.workspace_event_selections (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  season integer not null check (season between 2023 and 9999),
  event_code text not null check (event_code ~ '^[A-Za-z0-9]{3,30}$'),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.workspace_event_selections enable row level security;
drop policy if exists "Workspace members read official event selection" on public.workspace_event_selections;
create policy "Workspace members read official event selection" on public.workspace_event_selections for select to authenticated using(public.is_workspace_member(workspace_id));
drop policy if exists "Scouts update official event selection" on public.workspace_event_selections;
create policy "Scouts update official event selection" on public.workspace_event_selections for all to authenticated
  using(exists(select 1 from public.workspace_members wm where wm.workspace_id=workspace_event_selections.workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('admin','scout')))
  with check(exists(select 1 from public.workspace_members wm where wm.workspace_id=workspace_event_selections.workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('admin','scout')) and updated_by=(select auth.uid()));
grant select,insert,update,delete on public.workspace_event_selections to authenticated;
