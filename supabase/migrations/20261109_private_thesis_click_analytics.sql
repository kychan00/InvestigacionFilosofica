create schema if not exists private;

create table if not exists private.thesis_click_history (
  event_id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  thesis_id text,
  thesis_title text not null
    check (char_length(thesis_title) between 1 and 2000),
  discovery_source text not null
    check (discovery_source in ('search', 'atlas')),
  interaction_source text not null
    check (char_length(interaction_source) between 1 and 100),
  query_text text
    check (query_text is null or char_length(query_text) <= 2000),
  institution text
    check (institution is null or char_length(institution) <= 100),
  scope text
    check (scope is null or char_length(scope) <= 100),
  clicked_at timestamptz not null default now()
);

create index if not exists thesis_click_history_clicked_at_idx
  on private.thesis_click_history (clicked_at desc);

create index if not exists thesis_click_history_visitor_id_idx
  on private.thesis_click_history (visitor_id);

create index if not exists thesis_click_history_title_idx
  on private.thesis_click_history (lower(thesis_title));

alter table private.thesis_click_history enable row level security;

revoke all on table private.thesis_click_history
  from public, anon, authenticated, service_role;

grant usage on schema private to anon;
grant insert on table private.thesis_click_history to anon;

drop policy if exists "anon may append private thesis click analytics"
  on private.thesis_click_history;

create policy "anon may append private thesis click analytics"
  on private.thesis_click_history
  for insert
  to anon
  with check (true);

create or replace function public.log_thesis_click(
  p_visitor_id uuid,
  p_thesis_id text,
  p_thesis_title text,
  p_discovery_source text,
  p_interaction_source text,
  p_query_text text default null,
  p_institution text default null,
  p_scope text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_title text := left(trim(coalesce(p_thesis_title, '')), 2000);
  v_thesis_id text := nullif(left(trim(coalesce(p_thesis_id, '')), 500), '');
  v_discovery_source text := case
    when p_discovery_source in ('search', 'atlas') then p_discovery_source
    else null
  end;
  v_interaction_source text := left(trim(coalesce(p_interaction_source, '')), 100);
  v_query text := nullif(left(trim(coalesce(p_query_text, '')), 2000), '');
  v_institution text := nullif(left(trim(coalesce(p_institution, '')), 100), '');
  v_scope text := nullif(left(trim(coalesce(p_scope, '')), 100), '');
begin
  if p_visitor_id is null or v_title = '' or v_discovery_source is null or v_interaction_source = '' then
    return;
  end if;

  insert into private.thesis_click_history (
    visitor_id,
    thesis_id,
    thesis_title,
    discovery_source,
    interaction_source,
    query_text,
    institution,
    scope
  )
  values (
    p_visitor_id,
    v_thesis_id,
    v_title,
    v_discovery_source,
    v_interaction_source,
    v_query,
    v_institution,
    v_scope
  );
end;
$$;

revoke execute on function public.log_thesis_click(uuid, text, text, text, text, text, text, text)
  from public, authenticated, service_role;

grant execute on function public.log_thesis_click(uuid, text, text, text, text, text, text, text)
  to anon;
