-- Initial shared-storage schema for BIOBUZZ Scouting.
-- Apply only after creating a Supabase project and reviewing this migration.
create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'scout' check (role in ('admin', 'scout', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace and wm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace and wm.user_id = (select auth.uid()) and wm.role = 'admin'
  );
$$;

create or replace function public.add_workspace_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace_members(workspace_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;
create trigger workspace_owner_membership after insert on public.workspaces
for each row execute function public.add_workspace_owner();

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  number integer not null check (number > 0),
  name text not null,
  capabilities text not null default '',
  autonomous text not null default '',
  mechanical text not null default '',
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'observed', 'verified')),
  created_at timestamptz not null default now(),
  unique (workspace_id, number),
  unique (workspace_id, id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  number integer not null check (number > 0),
  event text not null,
  teams text[] not null check (cardinality(teams) = 4),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, number, event)
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  match_id uuid not null,
  team_number integer not null,
  status text not null check (status in ('draft', 'submitted')),
  auto text not null default '', teleop text not null default '', hive_tip text not null default '',
  pollen text not null default '', nectar text not null default '', flower_garden text not null default '',
  leave_park text not null default '', issues text not null default '', notes text not null default '',
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, match_id) references public.matches(workspace_id, id) on delete cascade,
  foreign key (workspace_id, team_number) references public.teams(workspace_id, number) on delete restrict,
  unique (workspace_id, match_id, team_number)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  details text not null default '',
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  due_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme jsonb not null default '{}'::jsonb check (jsonb_typeof(theme) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.observations enable row level security;
alter table public.tasks enable row level security;
alter table public.user_preferences enable row level security;

create policy "Members read their workspaces" on public.workspaces for select using (public.is_workspace_member(id));
create policy "Authenticated users create workspaces" on public.workspaces for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Admins update workspaces" on public.workspaces for update using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));
create policy "Admins delete workspaces" on public.workspaces for delete using (public.is_workspace_admin(id));
create policy "Members read workspace membership" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "Admins manage workspace membership" on public.workspace_members for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create policy "Members read teams" on public.teams for select using (public.is_workspace_member(workspace_id));
create policy "Scouts manage teams" on public.teams for all using (exists (select 1 from public.workspace_members wm where wm.workspace_id = teams.workspace_id and wm.user_id = (select auth.uid()) and wm.role in ('admin', 'scout'))) with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = teams.workspace_id and wm.user_id = (select auth.uid()) and wm.role in ('admin', 'scout')));
create policy "Members read matches" on public.matches for select using (public.is_workspace_member(workspace_id));
create policy "Scouts manage matches" on public.matches for all using (exists (select 1 from public.workspace_members wm where wm.workspace_id = matches.workspace_id and wm.user_id = (select auth.uid()) and wm.role in ('admin', 'scout'))) with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = matches.workspace_id and wm.user_id = (select auth.uid()) and wm.role in ('admin', 'scout')));
create policy "Members read observations" on public.observations for select using (public.is_workspace_member(workspace_id));
create policy "Scouts manage observations" on public.observations for all using (exists (select 1 from public.workspace_members wm where wm.workspace_id = observations.workspace_id and wm.user_id = (select auth.uid()) and wm.role in ('admin', 'scout'))) with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = observations.workspace_id and wm.user_id = (select auth.uid()) and wm.role in ('admin', 'scout')));
create policy "Members read tasks" on public.tasks for select using (public.is_workspace_member(workspace_id));
create policy "Scouts manage tasks" on public.tasks for all using (exists (select 1 from public.workspace_members wm where wm.workspace_id = tasks.workspace_id and wm.user_id = (select auth.uid()) and wm.role in ('admin', 'scout'))) with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = tasks.workspace_id and wm.user_id = (select auth.uid()) and wm.role in ('admin', 'scout')));
create policy "Users manage their own preferences" on public.user_preferences for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.workspaces, public.workspace_members, public.teams, public.matches, public.observations, public.tasks, public.user_preferences to authenticated;
