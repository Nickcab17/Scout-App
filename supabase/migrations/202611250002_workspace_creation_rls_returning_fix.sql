-- INSERT ... RETURNING also requires the new row to pass the SELECT policy.
-- BioBuzz's SELECT policy requires membership, which is added by an AFTER INSERT
-- trigger. Insert without RETURNING so the trigger can finish, then read the row
-- in a separate statement after the owner membership exists.
create or replace function public.create_workspace_with_owner(p_name text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_workspace_id uuid := pg_catalog.gen_random_uuid();
  new_workspace public.workspaces%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 100 then
    raise exception 'Workspace name must contain between 2 and 100 characters';
  end if;

  insert into public.workspaces(id, name, created_by)
  values (new_workspace_id, btrim(p_name), current_user_id);

  -- The AFTER INSERT trigger has completed before this statement begins.
  -- The SELECT policy now permits this owner to read their workspace.
  select w.* into new_workspace
  from public.workspaces as w
  where w.id = new_workspace_id;

  if not found then
    raise exception 'Workspace was inserted but is not visible to its owner';
  end if;

  if new_workspace.created_by <> current_user_id or not exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = new_workspace_id
      and wm.user_id = current_user_id
      and wm.role = 'admin'
  ) then
    raise exception 'Workspace owner Admin membership was not created';
  end if;

  return jsonb_build_object(
    'id', new_workspace.id,
    'name', new_workspace.name,
    'role', 'admin'
  );
end;
$$;

revoke all on function public.create_workspace_with_owner(text) from public, anon;
grant execute on function public.create_workspace_with_owner(text) to authenticated;

comment on function public.create_workspace_with_owner(text) is
  'Creates a workspace as the authenticated owner. Avoids INSERT RETURNING so the AFTER INSERT owner-membership trigger can satisfy the workspace SELECT policy before the row is read.';
