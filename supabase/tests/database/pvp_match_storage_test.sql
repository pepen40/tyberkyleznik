begin;

select plan(22);

select has_table('public', 'pvp_matches', 'match storage table exists');
select has_table('public', 'pvp_match_actions', 'action ledger table exists');
select is(
  (select pg_get_constraintdef(oid) from pg_constraint
   where conrelid = 'public.pvp_matches'::regclass and contype = 'p'),
  'PRIMARY KEY (match_id)',
  'match id is primary key'
);
select is(
  (select pg_get_constraintdef(oid) from pg_constraint
   where conrelid = 'public.pvp_match_actions'::regclass and contype = 'p'),
  'PRIMARY KEY (match_id, action_id)',
  'action idempotency key is primary key'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.pvp_matches'::regclass),
  'RLS enabled for pvp_matches'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.pvp_match_actions'::regclass),
  'RLS enabled for pvp_match_actions'
);
select is(
  (select count(*)::integer from pg_policy where polrelid in (
    'public.pvp_matches'::regclass, 'public.pvp_match_actions'::regclass
  )),
  0,
  'no RLS policies exist on match tables'
);

select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated', 'service_role', 'public']::name[]) AS role_set(role_name)
    cross join unnest(
      array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']::text[]
      || case when current_setting('server_version_num')::integer >= 170000
              then array['MAINTAIN']::text[] else array[]::text[] end
    ) AS privilege_set(privilege_name)
    cross join (values ('public.pvp_matches'::regclass), ('public.pvp_match_actions'::regclass)) AS table_set(table_oid)
    where has_table_privilege(role_name, table_oid, privilege_name)
       or (privilege_name in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
           and has_any_column_privilege(role_name, table_oid, privilege_name))
  ),
  'PUBLIC, anon, authenticated and service_role have no effective table or column privileges'
);
select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    where n.nspname = 'public'
      and c.relname in ('pvp_matches', 'pvp_match_actions')
      and a.grantee = 0
  ),
  'PUBLIC has no table privileges'
);
select ok(
  not exists (
    select 1
    from pg_attribute att
    join pg_class c on c.oid = att.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(att.attacl) a
    where n.nspname = 'public'
      and c.relname in ('pvp_matches', 'pvp_match_actions')
      and att.attnum > 0
      and not att.attisdropped
      and a.grantee = 0
  ),
  'PUBLIC has no column-level privileges'
);
select ok(
  not exists (
    select 1
    from pg_publication_tables
    where schemaname = 'public'
      and tablename in ('pvp_matches', 'pvp_match_actions')
  ),
  'match tables are absent from logical publications, including Realtime'
);

select is(
  (select count(*)::integer
   from pg_constraint
   where conrelid = 'public.pvp_matches'::regclass
     and contype = 'f'
     and confdeltype = 'n'),
  2,
  'both participant foreign keys preserve match rows with SET NULL'
);
select is(
  (select count(*)::integer
   from pg_constraint
   where conrelid = 'public.pvp_match_actions'::regclass
     and contype = 'f'
     and confdeltype = 'n'),
  1,
  'actor foreign key preserves action rows with SET NULL'
);
select is(
  (select count(*)::integer
   from pg_constraint
   where conrelid = 'public.pvp_match_actions'::regclass
     and conname = 'pvp_match_actions_match_id_fkey'
     and contype = 'f'
     and confdeltype = 'r'),
  1,
  'action history prevents match deletion with RESTRICT'
);

select lives_ok(
  $$insert into public.pvp_matches (
      match_id, room_topic, server_builds_version, state_format_version,
      ruleset_version, server_builds, state
    ) values (
      '10000000-0000-0000-0000-000000000001', 'pvp_test_match_1',
      1, 1, 1, '{}'::jsonb, '{}'::jsonb
    )$$,
  'valid match row satisfies required constraints'
);
select throws_ok(
  $$insert into public.pvp_matches (
      match_id, room_topic, version, server_builds_version, state_format_version,
      ruleset_version, server_builds, state
    ) values (
      '10000000-0000-0000-0000-000000000002', 'pvp_test_match_2',
      -1, 1, 1, 1, '{}'::jsonb, '{}'::jsonb
    )$$,
  '23514', null,
  'negative match version is rejected'
);
select throws_ok(
  $$insert into public.pvp_matches (
      match_id, room_topic, server_builds_version, state_format_version,
      ruleset_version, server_builds, state
    ) values (
      '10000000-0000-0000-0000-000000000003', 'pvp_test_match_3',
      1, 1, 1, '[]'::jsonb, '{}'::jsonb
    )$$,
  '23514', null,
  'server build snapshot must be a JSON object'
);
select throws_ok(
  $$insert into public.pvp_matches (
      match_id, room_topic, status, server_builds_version, state_format_version,
      ruleset_version, server_builds, state
    ) values (
      '10000000-0000-0000-0000-000000000004', 'pvp_test_match_4', 'active',
      1, 1, 1, '{}'::jsonb, '{}'::jsonb
    )$$,
  '23514', null,
  'active match requires a start timestamp'
);
select lives_ok(
  $$insert into public.pvp_match_actions (
      match_id, action_id, actor_side, action_kind, command,
      version_before, version_after, result
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001', 'host', 'attack',
      '{}'::jsonb, 0, 1, '{}'::jsonb
    )$$,
  'valid action row satisfies required constraints'
);
select throws_ok(
  $$insert into public.pvp_match_actions (
      match_id, action_id, actor_side, action_kind, command,
      version_before, version_after, result
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001', 'guest', 'attack',
      '{"changed": true}'::jsonb, 0, 1, '{}'::jsonb
    )$$,
  '23505', null,
  'reused action id is rejected by the primary key'
);
select throws_ok(
  $$insert into public.pvp_match_actions (
      match_id, action_id, actor_side, action_kind, command,
      version_before, version_after, result
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002', 'host', 'attack',
      '{}'::jsonb, 0, 2, '{}'::jsonb
    )$$,
  '23514', null,
  'action version must advance by exactly one'
);
select throws_ok(
  $$insert into public.pvp_match_actions (
      match_id, action_id, actor_side, action_kind, command,
      version_before, version_after, result
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000003', 'guest', 'defend',
      '{}'::jsonb, 0, 1, '{}'::jsonb
    )$$,
  '23505', null,
  'only one action can commit for a match version'
);

select * from finish();
rollback;
