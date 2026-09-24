begin;
-- Keep the public RPC itself authenticated-only, but make the policy predicate
-- safe for anon/non-owner reads by calling the SECURITY DEFINER function
-- directly. The private function returns only a boolean and enforces MFA.
grant usage on schema private to anon, authenticated;
grant execute on function private.cms_is_owner() to anon, authenticated;

drop policy if exists published_read on public.cms_entries;
create policy published_read on public.cms_entries for select to anon, authenticated
using (status='published' or private.cms_is_owner());

drop policy if exists owner_insert on public.cms_entries;
create policy owner_insert on public.cms_entries for insert to authenticated with check(private.cms_is_owner());
drop policy if exists owner_update on public.cms_entries;
create policy owner_update on public.cms_entries for update to authenticated using(private.cms_is_owner()) with check(private.cms_is_owner());
drop policy if exists owner_delete on public.cms_entries;
create policy owner_delete on public.cms_entries for delete to authenticated using(private.cms_is_owner());

drop policy if exists cms_media_read on storage.objects;
create policy cms_media_read on storage.objects for select to anon, authenticated using(bucket_id='cms-media' and (private.cms_is_owner() or exists(select 1 from public.cms_entries e where e.status='published' and (e.cover_image=name or name=any(e.media)))));
drop policy if exists cms_media_insert on storage.objects;
create policy cms_media_insert on storage.objects for insert to authenticated with check(bucket_id='cms-media' and private.cms_is_owner() and exists(select 1 from public.cms_entries e where split_part(name,'/',1)=e.id::text));
drop policy if exists cms_media_delete on storage.objects;
create policy cms_media_delete on storage.objects for delete to authenticated using(bucket_id='cms-media' and private.cms_is_owner());

drop policy if exists traces_public_read on public.fragment_traces;
create policy traces_public_read on public.fragment_traces for select to anon, authenticated using(status='visible' or private.cms_is_owner());
drop policy if exists traces_owner_update on public.fragment_traces;
create policy traces_owner_update on public.fragment_traces for update to authenticated using(private.cms_is_owner()) with check(private.cms_is_owner());
drop policy if exists traces_owner_delete on public.fragment_traces;
create policy traces_owner_delete on public.fragment_traces for delete to authenticated using(private.cms_is_owner());

drop policy if exists gallery_public_read on public.gallery_items;
create policy gallery_public_read on public.gallery_items for select to anon, authenticated using(status='published' or private.cms_is_owner());
drop policy if exists gallery_owner_insert on public.gallery_items;
create policy gallery_owner_insert on public.gallery_items for insert to authenticated with check(private.cms_is_owner());
drop policy if exists gallery_owner_update on public.gallery_items;
create policy gallery_owner_update on public.gallery_items for update to authenticated using(private.cms_is_owner()) with check(private.cms_is_owner());
drop policy if exists gallery_owner_delete on public.gallery_items;
create policy gallery_owner_delete on public.gallery_items for delete to authenticated using(private.cms_is_owner());

drop policy if exists gallery_media_read on storage.objects;
create policy gallery_media_read on storage.objects for select to anon, authenticated using(bucket_id='cms-media' and (private.cms_is_owner() or exists(select 1 from public.gallery_items g where g.status='published' and g.storage_path=name)));
drop policy if exists gallery_media_insert on storage.objects;
create policy gallery_media_insert on storage.objects for insert to authenticated with check(bucket_id='cms-media' and private.cms_is_owner() and name like 'gallery/%');
drop policy if exists gallery_media_delete on storage.objects;
create policy gallery_media_delete on storage.objects for delete to authenticated using(bucket_id='cms-media' and private.cms_is_owner() and name like 'gallery/%');
commit;