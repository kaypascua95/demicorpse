begin;
alter table public.cms_entries add column if not exists video_url text not null default '' check (length(video_url) <= 2000);
alter table public.cms_entries add column if not exists duration text not null default '' check (length(duration) <= 40);
alter table public.cms_entries add column if not exists featured boolean not null default false;
commit;
