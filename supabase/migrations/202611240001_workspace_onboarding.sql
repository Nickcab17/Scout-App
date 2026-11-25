-- Create a workspace and verify its owner membership in one transaction.
-- The existing workspace_owner_membership trigger assigns the creator as Admin.
create or replace function public.create_workspace_with_owner(p_name text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_workspace public.workspaces%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 100 then
    raise exception 'Workspace name must contain between 2 and 100 characters';
  end if;

  insert into public.workspaces(name, created_by)
  values (btrim(p_name), (select auth.uid()))
  returning * into new_workspace;

  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = new_workspace.id
      and wm.user_id = (select auth.uid())
      and wm.role = 'admin'
  ) then
    raise exception 'Workspace owner Admin membership was not created';
  end if;

  return jsonb_build_object('id', new_workspace.id, 'name', new_workspace.name, 'role', 'admin');
end;
$$;

revoke all on function public.create_workspace_with_owner(text) from public;
grant execute on function public.create_workspace_with_owner(text) to authenticated;
