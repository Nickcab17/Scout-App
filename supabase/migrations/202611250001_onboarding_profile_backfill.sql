-- Existing Auth accounts predate the signup trigger; ensure each has a profile.
-- The auth.users -> profiles relationship is preserved and RLS remains enabled.
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', '')
from auth.users u
on conflict (id) do nothing;

comment on function public.create_workspace_with_owner(text) is
  'Creates a workspace and verifies the owner Admin membership in the same transaction. Authenticated users only; ownership comes from auth.uid().';
comment on function public.add_workspace_owner() is
  'Trusted workspaces insert trigger. Runs with a fixed empty search_path to add the creator as Admin atomically.';

revoke all on function public.create_workspace_with_owner(text) from public, anon;
grant execute on function public.create_workspace_with_owner(text) to authenticated;
revoke all on function public.add_workspace_owner() from public, anon, authenticated;
