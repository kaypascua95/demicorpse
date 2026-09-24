-- Canonical production sync: production already uses moderated cms_traces.
-- This migration intentionally aligns only additive Play/Gallery schema used by current code.
alter table public.cms_entries add column if not exists video_url text not null default '' check(length(video_url)<=2000);
alter table public.cms_entries add column if not exists duration text not null default '' check(length(duration)<=40);
alter table public.cms_entries add column if not exists featured boolean not null default false;
create table if not exists public.gallery_items(id uuid primary key default gen_random_uuid(),caption text not null default '' check(length(caption)<=2000),image_url text not null default '',storage_path text,date date not null default current_date,location text not null default '' check(length(location)<=200),status text not null default 'draft' check(status in('draft','published')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),constraint gallery_items_image_source check((length(image_url)>0 and image_url ~ '^https://') or storage_path is not null));
