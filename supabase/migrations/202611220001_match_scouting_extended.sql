-- Preserve extended Match Scouting and FIRST identifiers in shared observations.
alter table public.matches
  add column if not exists season integer,
  add column if not exists event_code text,
  add column if not exists tournament_level text check (tournament_level is null or tournament_level in ('qual','playoff')),
  add column if not exists official_match_id text;

alter table public.observations
  add column if not exists captured_at timestamptz,
  add column if not exists pollen_count integer,
  add column if not exists alliance text check (alliance is null or alliance in ('red','blue')),
  add column if not exists season integer,
  add column if not exists event_code text,
  add column if not exists tournament_level text check (tournament_level is null or tournament_level in ('qual','playoff')),
  add column if not exists official_match_id text,
  add column if not exists actions jsonb,
  add column if not exists alliance_final jsonb,
  add column if not exists scoring_confirmed boolean not null default false,
  add column if not exists official_result jsonb;

create index if not exists observations_workspace_match_team_idx
  on public.observations(workspace_id, match_id, team_number);
create index if not exists matches_workspace_official_match_idx
  on public.matches(workspace_id, official_match_id)
  where official_match_id is not null;
