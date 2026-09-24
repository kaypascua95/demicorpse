begin;
alter table public.gallery_items add column if not exists storage_path text;
alter table public.gallery_items alter column image_url set default '';
alter table public.gallery_items drop constraint if exists gallery_items_image_url_check;
alter table public.gallery_items add constraint gallery_items_image_source check ((length(image_url)>0 and image_url ~ '^https://') or storage_path is not null);
create policy gallery_media_read on storage.objects for select to anon,authenticated using(bucket_id='cms-media' and (public.cms_is_owner() or exists(select 1 from public.gallery_items g where g.status='published' and g.storage_path=name)));
create policy gallery_media_insert on storage.objects for insert to authenticated with check(bucket_id='cms-media' and public.cms_is_owner() and name like 'gallery/%');
create policy gallery_media_delete on storage.objects for delete to authenticated using(bucket_id='cms-media' and public.cms_is_owner() and name like 'gallery/%');
commit;