do $pvp_test_environment$
begin
  if current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'PvP runtime tests require PostgreSQL 17';
  end if;

  if (select count(*) from pg_roles
      where rolname in ('anon', 'authenticated', 'service_role')) <> 3 then
    raise exception 'Supabase API roles are missing';
  end if;

  if to_regclass('auth.users') is null then
    raise exception 'Supabase Auth table auth.users is missing';
  end if;

  if to_regclass('realtime.messages') is null then
    raise exception 'Local Supabase Realtime schema is missing';
  end if;

  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'Local Supabase Realtime publication is missing';
  end if;
end
$pvp_test_environment$;

create extension if not exists pgtap with schema extensions;
