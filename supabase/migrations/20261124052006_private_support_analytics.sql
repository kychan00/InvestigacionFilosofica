-- Anonymous support analytics: event counts, not financial transactions.
create table private.support_events (
  event_id uuid primary key default gen_random_uuid(),
  event_day date not null default ((now() at time zone 'America/Mexico_City')::date),
  event_type text not null check (event_type in ('entry_click','page_view','checkout_click')),
  source text not null check (source in ('menu','acerca','directo')),
  check (event_type <> 'entry_click' or source in ('menu','acerca'))
);
create index support_events_day_idx on private.support_events(event_day);
alter table private.support_events enable row level security;
revoke all on table private.support_events from public, anon, authenticated, service_role;
grant usage on schema private to anon;
grant insert (event_type, source) on private.support_events to anon;
create policy "anon append support events" on private.support_events
  for insert to anon with check (true);
create function public.log_support_event(p_event_type text, p_source text)
returns void language sql security invoker set search_path = ''
as $$
  insert into private.support_events (event_type, source)
  values (p_event_type, p_source);
$$;
revoke all on function public.log_support_event(text,text) from public, anon, authenticated, service_role;
grant execute on function public.log_support_event(text,text) to anon;
comment on table private.support_events is 'Private anonymous support interaction events. No visitor identifier or payment information. Counts are approximate, not completed payments.';
