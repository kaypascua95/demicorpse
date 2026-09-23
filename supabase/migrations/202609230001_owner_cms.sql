begin;

-- A dedicated project is required. This singleton can only be set by a database
-- administrator; signing up, changing metadata, or claiming a role cannot grant ownership.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.cms_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id)
);
revoke all on private.cms_owner from public, anon, authenticated;
alter table private.cms_owner enable row level security;

create function public.cms_is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from private.cms_owner where user_id = (select auth.uid())) $$;
revoke all on function public.cms_is_owner() from public;
grant execute on function public.cms_is_owner() to anon, authenticated;

-- One table keeps authorization, media ownership and publication atomic across
-- the four collections. Collection-specific fields remain explicit columns.
create table public.cms_entries (
  id uuid primary key default gen_random_uuid(),
  collection text not null check (collection in ('journal','fragments','play','archive')),
  title text not null default '' check (length(title) <= 300),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 180),
  excerpt text not null default '' check (length(excerpt) <= 2000),
  content text not null default '' check (length(content) <= 200000),
  game text not null default '' check (length(game) <= 300),
  type text not null default '' check (length(type) <= 100),
  description text not null default '' check (length(description) <= 20000),
  cover_image text,
  media text[] not null default '{}',
  date date not null default current_date,
  status text not null default 'draft' check (status in ('draft','published')),
  tags text[] not null default '{}',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection, slug),
  check (cardinality(media) <= 30 and cardinality(tags) <= 30),
  check (status <> 'published' or (published_at is not null and
    case when collection = 'fragments' then length(btrim(content)) > 0
    else length(btrim(title)) > 0 end))
);
create index cms_published_entries on public.cms_entries(collection, date desc, id) where status = 'published';

create function private.cms_entry_guard() returns trigger
language plpgsql set search_path = '' as $$
declare object_path text;
begin
  if TG_OP = 'UPDATE' and (new.id <> old.id or new.collection <> old.collection) then
    raise exception 'Entry identity cannot be changed';
  end if;
  new.updated_at := now();
  if TG_OP = 'INSERT' then new.created_at := now();
  else new.created_at := old.created_at; end if;
  if new.status = 'published' then
    if TG_OP = 'INSERT' then new.published_at := now();
    elsif old.published_at is null then new.published_at := now();
    else new.published_at := old.published_at; end if;
  elsif TG_OP = 'UPDATE' then new.published_at := old.published_at;
  else new.published_at := null; end if;
  foreach object_path in array (new.media || case when new.cover_image is null then '{}'::text[] else array[new.cover_image] end) loop
    if object_path is null or object_path !~ ('^' || new.id::text || '/[a-f0-9-]+\.(jpg|png|webp|gif|mp4|webm|mp3|ogg)$') then
      raise exception 'Media must belong to this entry';
    end if;
  end loop;
  return new;
end $$;
create trigger cms_entry_guard before insert or update on public.cms_entries
for each row execute function private.cms_entry_guard();

alter table public.cms_entries enable row level security;
revoke all on public.cms_entries from public, anon, authenticated;
grant select on public.cms_entries to anon, authenticated;
grant insert, update, delete on public.cms_entries to authenticated;
create policy published_read on public.cms_entries for select to anon, authenticated
using (status = 'published' or (select public.cms_is_owner()));
create policy owner_insert on public.cms_entries for insert to authenticated
with check ((select public.cms_is_owner()));
create policy owner_update on public.cms_entries for update to authenticated
using ((select public.cms_is_owner())) with check ((select public.cms_is_owner()));
create policy owner_delete on public.cms_entries for delete to authenticated
using ((select public.cms_is_owner()));

-- Private bucket: no permanent public URLs. Downloads check the entry's current
-- publication state, including after unpublishing. SVG/HTML are never accepted.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cms-media','cms-media',false,26214400,
 array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/ogg']);

create policy cms_media_read on storage.objects for select to anon, authenticated
using (bucket_id = 'cms-media' and (
  (select public.cms_is_owner()) or exists (
    select 1 from public.cms_entries e where e.status = 'published'
    and (e.cover_image = name or name = any(e.media))
  )
));
create policy cms_media_insert on storage.objects for insert to authenticated
with check (bucket_id = 'cms-media' and (select public.cms_is_owner()) and exists (
  select 1 from public.cms_entries e where split_part(name,'/',1) = e.id::text
));
-- Deliberately no UPDATE policy: uploads get immutable random paths, no overwrites.
create policy cms_media_delete on storage.objects for delete to authenticated
using (bucket_id = 'cms-media' and (select public.cms_is_owner()));

commit;
