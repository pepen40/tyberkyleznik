#!/usr/bin/env bash
set -euo pipefail
# Disposable local CI stack only. No production URL or data cleanup commands.
db_url="$(supabase status -o env | sed -nE 's/^DB_URL="?([^" ]+)"?$/\1/p')"
[[ "$db_url" =~ ^postgres(ql)?://[^/]+@127\.0\.0\.1:[0-9]+/postgres$ ]] || {
  echo 'Expected a disposable local Supabase DB_URL' >&2; exit 1;
}
actor='00000000-0000-4000-8000-000000000921'
host='00000000-0000-4000-8000-000000000922'
psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('$actor','authenticated','authenticated','admission-actor@example.invalid','',now(),'{}','{}',now(),now()),
('$host','authenticated','authenticated','admission-host@example.invalid','',now(),'{}','{}',now(),now());
insert into public.players(user_id) values ('$actor'),('$host');
insert into public.realtime_room_access(topic,room_kind,host_user_id,guest_user_id,expires_at) values
('room_crossa001','rpg','$actor',null,now()+interval '1 day'),
('room_crossb001','rpg','$host','$actor',now()+interval '1 day');
select public.create_rpg_pvp_match('$host','10000000-0000-4000-8000-000000000922','room_crossb001','ashab');
SQL

# Keep the actor's host creation uncommitted while another connection tries
# to join a different host's match as the same actor. Independent role indexes
# alone permit both transactions to commit.
PGAPPNAME=pvp_admission_create psql "$db_url" -v ON_ERROR_STOP=1 >"$RUNNER_TEMP/admission-create.log" 2>&1 <<SQL &
begin;
select public.create_rpg_pvp_match('$actor','10000000-0000-4000-8000-000000000921','room_crossa001','ashab');
select pg_sleep(5);
commit;
SQL
creator=$!
ready=false
for attempt in {1..100}; do
  if [[ "$(psql "$db_url" -Atc "select count(*) from pg_stat_activity where application_name='pvp_admission_create' and wait_event='PgSleep'")" == 1 ]]; then
    ready=true; break
  fi
  sleep 0.02
done
[[ "$ready" == true ]] || { cat "$RUNNER_TEMP/admission-create.log" >&2; exit 1; }
set +e
psql "$db_url" -v ON_ERROR_STOP=1 -c "set statement_timeout='15s'; select public.join_rpg_pvp_match('$actor','room_crossb001','ashab');" >"$RUNNER_TEMP/admission-join.log" 2>&1
joined=$?
wait "$creator"
created=$?
set -e
[[ "$created" == 0 && "$joined" != 0 ]] || { cat "$RUNNER_TEMP"/admission-*.log >&2; exit 1; }
grep -q 'Player already has a live PvP match' "$RUNNER_TEMP/admission-join.log"
[[ "$(psql "$db_url" -Atc "select count(*) from public.pvp_matches where status in ('waiting','active') and (host_user_id='$actor' or guest_user_id='$actor')")" == 1 ]]
echo 'PASS: concurrent host creation and guest admission preserve one live match'

# Release the actor's waiting room through the normal API, then start the other
# match. A separate transaction holds its row until after the turn deadline.
psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
select public.cancel_rpg_pvp_match('$actor','room_crossa001');
select public.join_rpg_pvp_match('$actor','room_crossb001','ashab');
SQL
PGAPPNAME=pvp_deadline_lock psql "$db_url" -v ON_ERROR_STOP=1 >"$RUNNER_TEMP/deadline-lock.log" 2>&1 <<SQL &
begin;
update public.pvp_matches set last_action_at=clock_timestamp()-interval '3 minutes'+interval '1 second' where room_topic='room_crossb001';
select pg_sleep(3);
commit;
SQL
locker=$!
ready=false
for attempt in {1..100}; do
  if [[ "$(psql "$db_url" -Atc "select count(*) from pg_stat_activity where application_name='pvp_deadline_lock' and wait_event='PgSleep'")" == 1 ]]; then
    ready=true; break
  fi
  sleep 0.02
done
[[ "$ready" == true ]] || { cat "$RUNNER_TEMP/deadline-lock.log" >&2; exit 1; }
psql "$db_url" -v ON_ERROR_STOP=1 -c "set statement_timeout='15s'; select public.apply_rpg_pvp_action('$host','room_crossb001','20000000-0000-4000-8000-000000000922',1,'defend',null);"
wait "$locker"
[[ "$(psql "$db_url" -Atc "select count(*) from public.pvp_matches where room_topic='room_crossb001' and status='completed' and winner_side='guest' and version=2")" == 1 ]]
[[ "$(psql "$db_url" -Atc "select count(*) from public.pvp_match_actions a join public.pvp_matches m using(match_id) where m.room_topic='room_crossb001'")" == 0 ]]
echo 'PASS: an action blocked on a row lock cannot act past the deadline'
