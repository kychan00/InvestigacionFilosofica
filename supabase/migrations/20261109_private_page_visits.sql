-- Private visit/session analytics for Investigación Filosófica.
-- A visit represents one browser session separated by 30 minutes of inactivity.
-- No IP, user-agent, referrer, email, visitor name, or fingerprint is stored.

create schema if not exists private;

create table if not exists private.page_visits (
  visit_id uuid primary key,
  visitor_id uuid not null,
  entry_path text not null default '/'
    check (char_length(entry_path) between 1 and 500),
  started_at timestamptz not null default now()
);

create index if not exists page_visits_started_at_idx
  on private.page_visits (started_at desc);

create index if not exists page_visits_visitor_id_idx
  on private.page_visits (visitor_id);

alter table private.page_visits enable row level security;

revoke all on table private.page_visits
  from public, anon, authenticated, service_role;

grant usage on schema private to anon;
grant insert on table private.page_visits to anon;

drop policy if exists "anon may append private page visits"
  on private.page_visits;

create policy "anon may append private page visits"
  on private.page_visits
  for insert
  to anon
  with check (true);

create or replace function public.log_page_visit(
  p_visitor_id uuid,
  p_visit_id uuid,
  p_entry_path text default '/'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_path text := left(
    coalesce(nullif(trim(p_entry_path), ''), '/'),
    500
  );
begin
  if p_visitor_id is null or p_visit_id is null then
    return;
  end if;

  insert into private.page_visits (
    visit_id,
    visitor_id,
    entry_path
  )
  values (
    p_visit_id,
    p_visitor_id,
    v_path
  )
  on conflict (visit_id) do nothing;
end;
$$;

revoke execute on function public.log_page_visit(uuid, uuid, text)
  from public, authenticated, service_role;

grant execute on function public.log_page_visit(uuid, uuid, text)
  to anon;
