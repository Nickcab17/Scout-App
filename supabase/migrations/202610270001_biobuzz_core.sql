-- BioBuzz first versioned schema. Additive and safe to rerun for an empty project.
-- Existing deployments must reconcile this baseline with migration history before applying.
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'scout' check (role in ('admin', 'scout', 'viewer')),
  created_at timestamptz not null default now(), primary key (workspace_id, user_id)
);
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members wm where wm.workspace_id=target_workspace and wm.user_id=(select auth.uid()));
$$;
create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members wm where wm.workspace_id=target_workspace and wm.user_id=(select auth.uid()) and wm.role='admin');
$$;
create or replace function public.add_workspace_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace_members(workspace_id,user_id,role) values (new.id,new.created_by,'admin');
  return new;
end;
$$;
drop trigger if exists workspace_owner_membership on public.workspaces;
create trigger workspace_owner_membership after insert on public.workspaces for each row execute function public.add_workspace_owner();

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  number integer not null check (number>0), name text not null,
  capabilities text not null default '', autonomous text not null default '', mechanical text not null default '', notes text not null default '',
  status text not null default 'pending' check (status in ('pending','observed','verified')), created_at timestamptz not null default now(),
  unique (workspace_id,number), unique (workspace_id,id)
);
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null, name text not null, starts_on date, ends_on date, created_at timestamptz not null default now(),
  unique(workspace_id,code), unique(workspace_id,id)
);
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  season_id uuid not null, event_code text, name text not null,
  event_type text not null check(event_type in ('all_other_events','regional_championship','first_championship','premier_event','league_meet','qualifying')),
  source text not null default 'manual' check(source in ('manual','first_api')), created_at timestamptz not null default now(),
  foreign key(workspace_id,season_id) references public.seasons(workspace_id,id) on delete restrict, unique(workspace_id,id)
);
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  number integer not null check(number>0), event text not null, event_type text not null default 'not_configured' check(event_type in ('not_configured','all_other_events','regional_championship','first_championship','premier_event')), teams text[] not null check(cardinality(teams)=4),
  event_id uuid, season_id uuid, created_at timestamptz not null default now(),
  foreign key(workspace_id,event_id) references public.events(workspace_id,id) on delete restrict,
  foreign key(workspace_id,season_id) references public.seasons(workspace_id,id) on delete restrict,
  unique(workspace_id,id), unique(workspace_id,number,event)
);
alter table public.matches add column if not exists event_type text not null default 'not_configured';
alter table public.matches add column if not exists event_id uuid;
alter table public.matches add column if not exists season_id uuid;
create or replace function public.validate_match_workspace_teams()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from unnest(new.teams) as assigned(number)
    left join public.teams t on t.workspace_id=new.workspace_id and t.number=nullif(assigned.number,'')::integer
    where assigned.number<>'' and t.id is null
  ) then raise exception 'Every assigned team must belong to the match workspace'; end if;
  return new;
end;
$$;
drop trigger if exists matches_validate_team_workspace on public.matches;
create trigger matches_validate_team_workspace before insert or update of workspace_id,teams on public.matches
for each row execute function public.validate_match_workspace_teams();
create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  match_id uuid not null, team_number integer not null, scout_user_id uuid references auth.users(id) on delete set null,
  status text not null check(status in ('draft','submitted')),
  auto text not null default '', teleop text not null default '', hive_tip text not null default '', pollen text not null default '', nectar text not null default '',
  flower_garden text not null default '', leave_park text not null default '', issues text not null default '', notes text not null default '',
  scout_name text not null default '', scoring_input jsonb, updated_at timestamptz not null default now(),
  foreign key(workspace_id,match_id) references public.matches(workspace_id,id) on delete cascade,
  foreign key(workspace_id,team_number) references public.teams(workspace_id,number) on delete restrict,
  unique(workspace_id,match_id,team_number)
);
alter table public.observations add column if not exists scout_user_id uuid references auth.users(id) on delete set null;
alter table public.observations add column if not exists scout_name text not null default '';
alter table public.observations add column if not exists scoring_input jsonb;
create table if not exists public.pit_scouting (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  team_number integer not null, scout_user_id uuid references auth.users(id) on delete set null,
  robot_data jsonb not null check(jsonb_typeof(robot_data)='object'), notes text not null default '', updated_at timestamptz not null default now(),
  foreign key(workspace_id,team_number) references public.teams(workspace_id,number) on delete cascade,
  unique(workspace_id,team_number)
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check(length(trim(title)) between 1 and 200), details text not null default '', assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'open' check(status in ('open','in_progress','done','cancelled')), due_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.rule_configurations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  season_id uuid not null,
  event_type text not null, version text not null unique, source_url text not null, verified_at timestamptz,
  configuration jsonb not null check(jsonb_typeof(configuration)='object'), created_at timestamptz not null default now(),
  foreign key(workspace_id,season_id) references public.seasons(workspace_id,id) on delete restrict
);
create table if not exists public.scoring_results (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  observation_id uuid not null references public.observations(id) on delete cascade,
  rule_configuration_id uuid references public.rule_configurations(id) on delete restrict,
  engine_version text not null, results jsonb not null check(jsonb_typeof(results)='object'), calculated_at timestamptz not null default now(),
  unique(observation_id,engine_version)
);
create table if not exists public.official_match_results (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  match_id uuid not null, alliance text not null check(alliance in ('red','blue')), points integer not null check(points>=0),
  source text not null check(source in ('first_api','referee_verified')), external_id text, verified_by uuid references auth.users(id), verified_at timestamptz,
  foreign key(workspace_id,match_id) references public.matches(workspace_id,id) on delete cascade,
  unique(workspace_id,match_id,alliance)
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function public.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')) on conflict(id) do nothing;
  return new;
end;
$$;
drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup after insert on auth.users for each row execute function public.create_profile_for_auth_user();
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade, theme jsonb not null default '{}'::jsonb check(jsonb_typeof(theme)='object'), updated_at timestamptz not null default now()
);
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null, role text not null check(role in ('scout','viewer')), token_hash bytea not null unique,
  expires_at timestamptz not null, accepted_at timestamptz, created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);

create or replace function public.accept_workspace_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invite public.workspace_invites%rowtype; current_email text;
begin
  select lower(u.email) into current_email from auth.users u where u.id=(select auth.uid());
  if current_email is null then raise exception 'Authentication required'; end if;
  select * into invite from public.workspace_invites wi where wi.token_hash=extensions.digest(invite_token,'sha256') and wi.accepted_at is null and wi.expires_at>now() and lower(wi.email)=current_email for update;
  if invite.id is null then raise exception 'Invite is invalid, expired, or for another account'; end if;
  insert into public.workspace_members(workspace_id,user_id,role) values(invite.workspace_id,(select auth.uid()),invite.role)
    on conflict(workspace_id,user_id) do nothing;
  update public.workspace_invites set accepted_at=now() where id=invite.id;
  return invite.workspace_id;
end;
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['workspaces','workspace_members','teams','seasons','events','matches','observations','pit_scouting','tasks','rule_configurations','scoring_results','official_match_results','profiles','user_preferences','workspace_invites'] loop
    execute format('alter table public.%I enable row level security',table_name);
  end loop;
end $$;

drop policy if exists "Members read their workspaces" on public.workspaces;
create policy "Members read their workspaces" on public.workspaces for select to authenticated using(public.is_workspace_member(id));
drop policy if exists "Authenticated users create workspaces" on public.workspaces;
create policy "Authenticated users create workspaces" on public.workspaces for insert to authenticated with check(created_by=(select auth.uid()));
drop policy if exists "Admins update workspaces" on public.workspaces;
create policy "Admins update workspaces" on public.workspaces for update to authenticated using(public.is_workspace_admin(id)) with check(public.is_workspace_admin(id));
drop policy if exists "Admins delete workspaces" on public.workspaces;
create policy "Admins delete workspaces" on public.workspaces for delete to authenticated using(public.is_workspace_admin(id));

drop policy if exists "Members read workspace membership" on public.workspace_members;
create policy "Members read workspace membership" on public.workspace_members for select to authenticated using(public.is_workspace_member(workspace_id));
drop policy if exists "Admins manage workspace membership" on public.workspace_members;
create policy "Admins manage workspace membership" on public.workspace_members for all to authenticated using(public.is_workspace_admin(workspace_id)) with check(public.is_workspace_admin(workspace_id));
drop policy if exists "Users manage their own preferences" on public.user_preferences;
create policy "Users manage their own preferences" on public.user_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists "Users read their profile" on public.profiles;
create policy "Users read their profile" on public.profiles for select to authenticated using(id=(select auth.uid()));
drop policy if exists "Users update their profile" on public.profiles;
create policy "Users update their profile" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

do $$ declare table_name text; begin
  foreach table_name in array array['teams','seasons','events','matches','observations','pit_scouting','tasks','scoring_results'] loop
    execute format('drop policy if exists "Workspace member read %1$s" on public.%1$I',table_name);
    execute format('create policy "Workspace member read %1$s" on public.%1$I for select to authenticated using(public.is_workspace_member(workspace_id))',table_name);
    execute format('drop policy if exists "Scouts write %1$s" on public.%1$I',table_name);
    execute format('create policy "Scouts write %1$s" on public.%1$I for all to authenticated using(exists(select 1 from public.workspace_members wm where wm.workspace_id=%1$I.workspace_id and wm.user_id=(select auth.uid()) and wm.role in (''admin'',''scout''))) with check(exists(select 1 from public.workspace_members wm where wm.workspace_id=%1$I.workspace_id and wm.user_id=(select auth.uid()) and wm.role in (''admin'',''scout'')))',table_name);
  end loop;
end $$;

drop policy if exists "Admins manage workspace invites" on public.workspace_invites;
create policy "Admins manage workspace invites" on public.workspace_invites for all to authenticated using(public.is_workspace_admin(workspace_id)) with check(public.is_workspace_admin(workspace_id));
drop policy if exists "Admins manage rule configurations" on public.rule_configurations;
create policy "Admins manage rule configurations" on public.rule_configurations for all to authenticated using(public.is_workspace_admin(workspace_id)) with check(public.is_workspace_admin(workspace_id));
drop policy if exists "Admins manage official results" on public.official_match_results;
create policy "Admins manage official results" on public.official_match_results for all to authenticated using(public.is_workspace_admin(workspace_id)) with check(public.is_workspace_admin(workspace_id));
revoke all on function public.accept_workspace_invite(text) from public;
grant execute on function public.accept_workspace_invite(text) to authenticated;
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.workspaces,public.workspace_members,public.teams,public.seasons,public.events,public.matches,public.observations,public.pit_scouting,public.tasks,public.rule_configurations,public.scoring_results,public.official_match_results,public.profiles,public.user_preferences,public.workspace_invites to authenticated;
