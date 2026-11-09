-- Private behavioral analytics for Investigación Filosófica.
-- Stores only pseudonymous browser UUID + explicit search/author interaction data.
-- No IP address, user-agent, referrer, email, name of the visitor, or fingerprint.

create schema if not exists private;

create table if not exists private.search_history (
  event_id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  query_text text not null
    check (char_length(query_text) between 1 and 2000),
  search_mode text not null default 'unknown'
    check (search_mode in ('federated', 'semantic', 'unknown')),
  searched_at timestamptz not null default now()
);

create index if not exists search_history_searched_at_idx
  on private.search_history (searched_at desc);

create index if not exists search_history_visitor_id_idx
  on private.search_history (visitor_id);

alter table private.search_history enable row level security;

revoke all on table private.search_history
  from public, anon, authenticated, service_role;

grant usage on schema private to anon;
grant insert on table private.search_history to anon;

drop policy if exists "anon may append private search analytics"
  on private.search_history;

create policy "anon may append private search analytics"
  on private.search_history
  for insert
  to anon
  with check (true);


create table if not exists private.author_history (
  event_id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  author_name text not null
    check (char_length(author_name) between 1 and 500),
  author_id text,
  orcid text,
  event_type text not null
    check (event_type in ('searched', 'clicked')),
  interaction_source text,
  occurred_at timestamptz not null default now()
);

create index if not exists author_history_occurred_at_idx
  on private.author_history (occurred_at desc);

create index if not exists author_history_visitor_id_idx
  on private.author_history (visitor_id);

create index if not exists author_history_author_name_idx
  on private.author_history (lower(author_name));

alter table private.author_history enable row level security;

revoke all on table private.author_history
  from public, anon, authenticated, service_role;

grant insert on table private.author_history to anon;

drop policy if exists "anon may append private author analytics"
  on private.author_history;

create policy "anon may append private author analytics"
  on private.author_history
  for insert
  to anon
  with check (true);


create or replace function public.log_search_event(
  p_visitor_id uuid,
  p_query_text text,
  p_search_mode text default 'unknown'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_query text := left(trim(coalesce(p_query_text, '')), 2000);
  v_mode text := case
    when p_search_mode in ('federated', 'semantic') then p_search_mode
    else 'unknown'
  end;
begin
  if p_visitor_id is null or v_query = '' then
    return;
  end if;

  insert into private.search_history (
    visitor_id,
    query_text,
    search_mode
  )
  values (
    p_visitor_id,
    v_query,
    v_mode
  );
end;
$$;

revoke execute on function public.log_search_event(uuid, text, text)
  from public, authenticated, service_role;

grant execute on function public.log_search_event(uuid, text, text)
  to anon;


create or replace function public.log_author_event(
  p_visitor_id uuid,
  p_author_name text,
  p_author_id text default null,
  p_orcid text default null,
  p_event_type text default 'clicked',
  p_interaction_source text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := left(trim(coalesce(p_author_name, '')), 500);
  v_author_id text := nullif(left(trim(coalesce(p_author_id, '')), 500), '');
  v_orcid text := nullif(left(trim(coalesce(p_orcid, '')), 100), '');
  v_event_type text := case
    when p_event_type in ('searched', 'clicked') then p_event_type
    else 'clicked'
  end;
  v_source text := nullif(left(trim(coalesce(p_interaction_source, '')), 100), '');
begin
  if p_visitor_id is null or v_name = '' then
    return;
  end if;

  insert into private.author_history (
    visitor_id,
    author_name,
    author_id,
    orcid,
    event_type,
    interaction_source
  )
  values (
    p_visitor_id,
    v_name,
    v_author_id,
    v_orcid,
    v_event_type,
    v_source
  );
end;
$$;

revoke execute on function public.log_author_event(uuid, text, text, text, text, text)
  from public, authenticated, service_role;

grant execute on function public.log_author_event(uuid, text, text, text, text, text)
  to anon;
