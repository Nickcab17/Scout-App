-- Store multiple official FIRST events per workspace and season.
-- Keep workspace_event_selections as the single active event used by scouting.
create table if not exists public.workspace_regional_selections (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  season integer not null check (season between 2023 and 9999),
  event_code text not null check (event_code ~ '^[A-Za-z0-9]{3,30}$'),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, season, event_code)
);

-- Preserve the event previously saved as active for each workspace.
insert into public.workspace_regional_selections (workspace_id, season, event_code, updated_by, updated_at)
select workspace_id, season, upper(event_code), updated_by, updated_at
from public.workspace_event_selections
on conflict (workspace_id, season, event_code) do nothing;

alter table public.workspace_regional_selections enable row level security;
drop policy if exists "Workspace members read regional selections" on public.workspace_regional_selections;
create policy "Workspace members read regional selections"
  on public.workspace_regional_selections for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists "Scouts manage regional selections" on public.workspace_regional_selections;
create policy "Scouts manage regional selections"
  on public.workspace_regional_selections for all to authenticated
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_regional_selections.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('admin', 'scout')
  ))
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_regional_selections.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('admin', 'scout')
    )
    and updated_by = (select auth.uid())
  );
grant select, insert, delete on public.workspace_regional_selections to authenticated;

-- Replace a season's multi-event selection atomically under the caller's RLS role.
create or replace function public.save_workspace_regional_selections(
  p_workspace_id uuid,
  p_season integer,
  p_event_codes text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_codes text[] := coalesce(p_event_codes, array[]::text[]);
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_season is null or p_season not between 2023 and 9999 then
    raise exception 'Season is invalid';
  end if;
  if cardinality(normalized_codes) > 200 or exists (
    select 1 from unnest(normalized_codes) as incoming(code)
    where incoming.code is null or incoming.code !~ '^[A-Za-z0-9]{3,30}$'
  ) then
    raise exception 'Event codes are invalid';
  end if;
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = current_user_id
      and wm.role in ('admin', 'scout')
  ) then
    raise exception 'Admin or Scout membership required';
  end if;

  delete from public.workspace_regional_selections
  where workspace_id = p_workspace_id and season = p_season;

  insert into public.workspace_regional_selections (workspace_id, season, event_code, updated_by)
  select p_workspace_id, p_season, upper(code), current_user_id
  from (
    select distinct incoming.code
    from unnest(normalized_codes) as incoming(code)
  ) as selected;
end;
$$;
revoke all on function public.save_workspace_regional_selections(uuid, integer, text[]) from public, anon;
grant execute on function public.save_workspace_regional_selections(uuid, integer, text[]) to authenticated;

-- Profiles are private to their owner. Expose names to workspace admins only,
-- with the workspace and caller authorization checked inside this function.
create or replace function public.get_workspace_members_with_profiles(p_workspace_id uuid)
returns table (user_id uuid, role text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select wm.user_id, wm.role, nullif(btrim(p.display_name), '')
  from public.workspace_members as wm
  left join public.profiles as p on p.id = wm.user_id
  where wm.workspace_id = p_workspace_id
    and exists (
      select 1 from public.workspace_members as caller
      where caller.workspace_id = p_workspace_id
        and caller.user_id = (select auth.uid())
        and caller.role = 'admin'
    )
  order by wm.created_at, wm.user_id;
$$;
revoke all on function public.get_workspace_members_with_profiles(uuid) from public, anon;
grant execute on function public.get_workspace_members_with_profiles(uuid) to authenticated;
