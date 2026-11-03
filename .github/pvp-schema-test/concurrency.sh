#!/usr/bin/env bash
set -euo pipefail

db_url="$(supabase status -o env | sed -nE 's/^DB_URL="?([^" ]+)"?$/\1/p')"
if [[ ! "$db_url" =~ ^postgres(ql)?://[^/]+@127\.0\.0\.1:[0-9]+/postgres$ ]]; then
  echo "Expected a disposable local Supabase DB_URL" >&2
  exit 1
fi

host_user='00000000-0000-4000-8000-000000000901'
guest_user='00000000-0000-4000-8000-000000000902'
match_id='10000000-0000-4000-8000-000000000901'
action_a='20000000-0000-4000-8000-000000000901'
action_b='20000000-0000-4000-8000-000000000902'
room_topic='room_racecase1'

psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('$host_user','authenticated','authenticated','pvp-race-host@example.invalid','',now(),'{}','{}',now(),now()),
  ('$guest_user','authenticated','authenticated','pvp-race-guest@example.invalid','',now(),'{}','{}',now(),now());

insert into public.players (user_id, rpg_upgrades, inventory, item_points)
values
  ('$host_user','{"ashab":{"hp":0,"atk":0}}','[]',0),
  ('$guest_user','{"ashab":{"hp":0,"atk":0}}','[]',0);

insert into public.realtime_room_access (topic, room_kind, host_user_id, guest_user_id, invitee_user_id, is_public, expires_at)
values ('$room_topic','rpg','$host_user','$guest_user','$guest_user',false,now() + interval '5 minutes');

select public.create_rpg_pvp_match('$host_user','$match_id','$room_topic','ashab');
select public.join_rpg_pvp_match('$guest_user','$room_topic','ashab');
SQL

psql_action() {
  local action_id="$1"
  psql "$db_url" -v ON_ERROR_STOP=1 -c "select pg_sleep(0.25); select public.apply_rpg_pvp_action('$host_user','$room_topic','$action_id',1,'attack',null);"
}

psql_action "$action_a" >"$RUNNER_TEMP/pvp-race-a.log" 2>&1 &
pid_a=$!
psql_action "$action_b" >"$RUNNER_TEMP/pvp-race-b.log" 2>&1 &
pid_b=$!

set +e
wait "$pid_a"
status_a=$?
wait "$pid_b"
status_b=$?
set -e

if ! { [[ "$status_a" -eq 0 && "$status_b" -ne 0 ]] || [[ "$status_a" -ne 0 && "$status_b" -eq 0 ]]; }; then
  cat "$RUNNER_TEMP/pvp-race-a.log" "$RUNNER_TEMP/pvp-race-b.log" >&2
  echo "Expected exactly one competing action to succeed" >&2
  exit 1
fi

if ! grep -q 'Stale match version' "$RUNNER_TEMP/pvp-race-a.log" "$RUNNER_TEMP/pvp-race-b.log"; then
  cat "$RUNNER_TEMP/pvp-race-a.log" "$RUNNER_TEMP/pvp-race-b.log" >&2
  echo "The losing request did not fail as a stale version" >&2
  exit 1
fi

psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
do \$assert_race\$
begin
  if (select version from public.pvp_matches where match_id='$match_id') <> 2 then
    raise exception 'Concurrent actions advanced more than one state version';
  end if;
  if (select count(*) from public.pvp_match_actions where match_id='$match_id') <> 1 then
    raise exception 'Concurrent actions recorded more than one state transition';
  end if;
end
\$assert_race\$;

delete from public.pvp_match_actions where match_id='$match_id';
delete from public.pvp_matches where match_id='$match_id';
delete from public.realtime_room_access where topic='$room_topic';
delete from public.players where user_id in ('$host_user','$guest_user');
delete from auth.users where id in ('$host_user','$guest_user');
SQL

echo "Concurrent PvP action test passed: one accepted action, one stale rejection, one version advance."
