begin;
-- Keep the privileged lookup out of the exposed API schema. The public RPC is
-- an invoker-only wrapper returning a boolean about the caller, never an ID.
alter function public.cms_is_owner() set schema private;
grant usage on schema private to anon, authenticated;
create function public.cms_is_owner() returns boolean
language sql stable security invoker set search_path = ''
as $$ select private.cms_is_owner() $$;
revoke all on function public.cms_is_owner() from public;
grant execute on function public.cms_is_owner() to authenticated;
create policy no_client_owner_access on private.cms_owner for all to anon, authenticated
using (false) with check (false);
commit;
