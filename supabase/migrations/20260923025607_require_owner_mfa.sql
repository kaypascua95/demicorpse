begin;
-- Identity-only lookup for the enrollment screen. This does NOT authorize data access.
create function private.cms_is_owner_account() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from private.cms_owner where user_id = (select auth.uid())) $$;
revoke all on function private.cms_is_owner_account() from public, anon;
grant execute on function private.cms_is_owner_account() to authenticated;

create function public.cms_is_owner_account() returns boolean
language sql stable security invoker set search_path = ''
as $$ select private.cms_is_owner_account() $$;
revoke all on function public.cms_is_owner_account() from public, anon;
grant execute on function public.cms_is_owner_account() to authenticated;

-- Every existing content and storage owner policy calls this function.
-- Require MFA even before enrollment: a password-only session is never a writer.
create or replace function private.cms_is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select auth.jwt()->>'aal') = 'aal2', false)
  and exists(select 1 from private.cms_owner where user_id = (select auth.uid())) $$;
commit;
