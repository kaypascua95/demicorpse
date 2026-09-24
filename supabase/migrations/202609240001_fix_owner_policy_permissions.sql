begin;
-- Public owner RPC intentionally remains unavailable to anon. Policies must not
-- invoke it for anonymous requests, while authenticated callers need permission
-- to execute the private implementation used by the invoker wrapper.
grant usage on schema private to authenticated;
grant execute on function private.cms_is_owner() to authenticated;

drop policy if exists published_read on public.cms_entries;
create policy published_read on public.cms_entries for select to anon, authenticated
using (status='published' or case when auth.uid() is not null then public.cms_is_owner() else false end);

drop policy if exists cms_media_read on storage.objects;
create policy cms_media_read on storage.objects for select to anon, authenticated
using (bucket_id='cms-media' and (
  case when auth.uid() is not null then public.cms_is_owner() else false end
  or exists(select 1 from public.cms_entries e where e.status='published'
    and (e.cover_image=name or name=any(e.media)))
));

drop policy if exists traces_public_read on public.fragment_traces;
create policy traces_public_read on public.fragment_traces for select to anon, authenticated
using (status='visible' or case when auth.uid() is not null then public.cms_is_owner() else false end);

drop policy if exists gallery_public_read on public.gallery_items;
create policy gallery_public_read on public.gallery_items for select to anon, authenticated
using (status='published' or case when auth.uid() is not null then public.cms_is_owner() else false end);

drop policy if exists gallery_media_read on storage.objects;
create policy gallery_media_read on storage.objects for select to anon, authenticated
using (bucket_id='cms-media' and (
  case when auth.uid() is not null then public.cms_is_owner() else false end
  or exists(select 1 from public.gallery_items g where g.status='published' and g.storage_path=name)
));
commit;