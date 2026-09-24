begin;
create table if not exists public.fragment_traces (
 id uuid primary key default gen_random_uuid(),
 fragment_id uuid not null references public.cms_entries(id) on delete cascade,
 parent_id uuid references public.fragment_traces(id) on delete cascade,
 display_name text not null default 'Anonymous' check(length(display_name) between 1 and 80),
 body text not null check(length(btrim(body)) between 1 and 3000),
 status text not null default 'visible' check(status in ('visible','hidden')),
 owner_reply boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.fragment_traces enable row level security;
revoke all on public.fragment_traces from public,anon,authenticated;
grant select,insert on public.fragment_traces to anon,authenticated;
grant update,delete on public.fragment_traces to authenticated;
create policy traces_public_read on public.fragment_traces for select to anon,authenticated using(status='visible' or public.cms_is_owner());
create policy traces_public_insert on public.fragment_traces for insert to anon,authenticated with check(parent_id is null and owner_reply=false and status='visible' and exists(select 1 from public.cms_entries e where e.id=fragment_id and e.collection='fragments' and e.status='published'));
create policy traces_owner_update on public.fragment_traces for update to authenticated using(public.cms_is_owner()) with check(public.cms_is_owner());
create policy traces_owner_delete on public.fragment_traces for delete to authenticated using(public.cms_is_owner());
commit;