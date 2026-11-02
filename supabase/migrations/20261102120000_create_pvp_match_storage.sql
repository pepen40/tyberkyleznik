begin;

create table public.pvp_matches (
  match_id uuid primary key,
  room_topic text not null unique,
  host_user_id uuid references auth.users(id) on delete set null,
  guest_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'completed', 'cancelled', 'expired')),
  current_turn_side text check (current_turn_side in ('host', 'guest')),
  version bigint not null default 0 check (version >= 0),
  server_builds_version smallint not null check (server_builds_version > 0),
  state_format_version smallint not null check (state_format_version > 0),
  ruleset_version integer not null check (ruleset_version > 0),
  server_builds jsonb not null check (jsonb_typeof(server_builds) = 'object'),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default transaction_timestamp(),
  started_at timestamptz,
  last_action_at timestamptz not null default transaction_timestamp(),
  completed_at timestamptz,
  winner_side text check (winner_side in ('host', 'guest')),
  constraint pvp_matches_distinct_participants
    check (host_user_id is null or guest_user_id is null or host_user_id <> guest_user_id),
  constraint pvp_matches_turn_only_while_active
    check (current_turn_side is null or status = 'active'),
  constraint pvp_matches_winner_only_when_completed
    check (winner_side is null or status = 'completed'),
  constraint pvp_matches_status_timestamps check (
    (status = 'waiting' and started_at is null and completed_at is null)
    or (status = 'active' and started_at is not null and completed_at is null)
    or (status in ('completed', 'cancelled', 'expired') and completed_at is not null)
  )
);

create table public.pvp_match_actions (
  match_id uuid not null references public.pvp_matches(match_id) on delete restrict,
  action_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_side text not null check (actor_side in ('host', 'guest')),
  action_kind text not null check (action_kind in ('attack', 'defend', 'skill', 'use_item', 'leave')),
  command jsonb not null check (jsonb_typeof(command) = 'object'),
  version_before bigint not null check (version_before >= 0),
  version_after bigint not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default transaction_timestamp(),
  constraint pvp_match_actions_idempotency_pk primary key (match_id, action_id),
  constraint pvp_match_actions_version_step check (version_after = version_before + 1),
  constraint pvp_match_actions_one_transition_per_version unique (match_id, version_after)
);

create index pvp_matches_host_live_idx
  on public.pvp_matches (host_user_id, last_action_at)
  where status in ('waiting', 'active');
create index pvp_matches_guest_live_idx
  on public.pvp_matches (guest_user_id, last_action_at)
  where status in ('waiting', 'active');
create index pvp_matches_live_cleanup_idx
  on public.pvp_matches (last_action_at)
  where status in ('waiting', 'active');

alter table public.pvp_matches enable row level security;
alter table public.pvp_match_actions enable row level security;

revoke all privileges on table public.pvp_matches
  from public, anon, authenticated, service_role;
revoke all privileges on table public.pvp_match_actions
  from public, anon, authenticated, service_role;

do $pvp_acl_check$
declare
  v_roles name[] := array[
    'anon'::name, 'authenticated'::name, 'service_role'::name, 'public'::name
  ];
  v_tables regclass[] := array[
    'public.pvp_matches'::regclass,
    'public.pvp_match_actions'::regclass
  ];
  v_table_privileges text[] := array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ];
  v_column_privileges text[] := array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'];
  v_role name;
  v_table regclass;
  v_privilege text;
begin
  if current_setting('server_version_num')::integer >= 170000 then
    v_table_privileges := array_append(v_table_privileges, 'MAINTAIN');
  end if;

  foreach v_role in array v_roles loop
    foreach v_table in array v_tables loop
      foreach v_privilege in array v_table_privileges loop
        if has_table_privilege(v_role, v_table, v_privilege) then
          raise exception 'Unexpected effective table privilege % for role % on %',
            v_privilege, v_role, v_table;
        end if;
      end loop;
      foreach v_privilege in array v_column_privileges loop
        if has_any_column_privilege(v_role, v_table, v_privilege) then
          raise exception 'Unexpected effective column privilege % for role % on %',
            v_privilege, v_role, v_table;
        end if;
      end loop;
    end loop;
  end loop;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    where n.nspname = 'public'
      and c.relname in ('pvp_matches', 'pvp_match_actions')
      and a.grantee = 0
      and a.privilege_type in (
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
      )
  ) then
    raise exception 'Unexpected table-level PUBLIC ACL on PvP match tables';
  end if;

  if exists (
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
      and a.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
  ) then
    raise exception 'Unexpected column-level PUBLIC ACL on PvP match tables';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_policy p on p.polrelid = c.oid
    where n.nspname = 'public'
      and c.relname in ('pvp_matches', 'pvp_match_actions')
  ) then
    raise exception 'Unexpected RLS policy on PvP match tables';
  end if;

  if exists (
    select 1
    from pg_publication_tables
    where schemaname = 'public'
      and tablename in ('pvp_matches', 'pvp_match_actions')
  ) then
    raise exception 'PvP match tables must not be published to Realtime/logical publications';
  end if;
end
$pvp_acl_check$;

commit;
