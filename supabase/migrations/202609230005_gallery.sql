begin;
create table if not exists public.gallery_items(id uuid primary key default gen_random_uuid(),caption text not null default '' check(length(caption)<=2000),image_url text not null check(image_url ~ '^https://'),date date not null default current_date,location text not null default '' check(length(location)<=200),status text not null default 'draft' check(status in('draft','published')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.gallery_items enable row level security;revoke all on public.gallery_items from public,anon,authenticated;grant select on public.gallery_items to anon,authenticated;grant insert,update,delete on public.gallery_items to authenticated;
create policy gallery_public_read on public.gallery_items for select to anon,authenticated using(status='published' or public.cms_is_owner());
create policy gallery_owner_insert on public.gallery_items for insert to authenticated with check(public.cms_is_owner());
create policy gallery_owner_update on public.gallery_items for update to authenticated using(public.cms_is_owner()) with check(public.cms_is_owner());
create policy gallery_owner_delete on public.gallery_items for delete to authenticated using(public.cms_is_owner());
commit;