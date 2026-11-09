-- Privacy-preserving visitor counter for Investigación Filosófica.
-- One random browser installation ID = one approximate unique visitor.
-- No IP address, user agent, referrer, email, name, or page history is stored.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.site_visitors (
  visitor_id uuid primary key,
  first_seen_at timestamptz not null default now()
);

revoke all on table private.site_visitors from public;
revoke all on table private.site_visitors from anon;
revoke all on table private.site_visitors from authenticated;

create or replace function private.register_site_visitor(p_visitor_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total bigint;
begin
  if p_visitor_id is null then
    raise exception 'visitor id is required';
  end if;

  insert into private.site_visitors (visitor_id)
  values (p_visitor_id)
  on conflict (visitor_id) do nothing;

  select count(*)
    into v_total
    from private.site_visitors;

  return v_total;
end;
$$;

revoke execute on function private.register_site_visitor(uuid) from public;
revoke execute on function private.register_site_visitor(uuid) from authenticated;
revoke execute on function private.register_site_visitor(uuid) from service_role;

grant usage on schema private to anon;
grant execute on function private.register_site_visitor(uuid) to anon;

create or replace function public.register_site_visitor(p_visitor_id uuid)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.register_site_visitor(p_visitor_id);
$$;

revoke execute on function public.register_site_visitor(uuid) from public;
revoke execute on function public.register_site_visitor(uuid) from authenticated;
revoke execute on function public.register_site_visitor(uuid) from service_role;
grant execute on function public.register_site_visitor(uuid) to anon;
