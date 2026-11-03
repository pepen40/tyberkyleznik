begin;
select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001','authenticated','authenticated','pvp-host@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-4000-8000-000000000002','authenticated','authenticated','pvp-guest@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-4000-8000-000000000003','authenticated','authenticated','pvp-outsider@example.invalid','',now(),'{}','{}',now(),now())
on conflict (id) do nothing;

insert into public.players (user_id, rpg_upgrades, inventory, item_points)
values
  ('00000000-0000-4000-8000-000000000001','{"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}}','[{"id":"pvp-potato-1","name":"картофель"}]',5),
  ('00000000-0000-4000-8000-000000000002','{"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}}','[]',0),
  ('00000000-0000-4000-8000-000000000003','{"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}}','[]',0)
on conflict (user_id) do update set inventory = excluded.inventory, rpg_upgrades = excluded.rpg_upgrades, item_points = excluded.item_points;

insert into public.realtime_room_access (topic, room_kind, host_user_id, guest_user_id, is_public, expires_at)
values
  ('room_stale0001','rpg','00000000-0000-4000-8000-000000000001',null,true,now()+interval '1 day'),
  ('room_guestold1','rpg','00000000-0000-4000-8000-000000000002',null,true,now()+interval '1 day'),
  ('room_orphans01','rpg','00000000-0000-4000-8000-000000000003',null,true,now()+interval '1 day'),
  ('room_test00001','rpg','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',true,now()+interval '1 day'),
  ('room_delete001','rpg','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',true,now()+interval '1 day');


select lives_ok($$select public.create_rpg_pvp_match('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','room_test00001','ashab')$$,'create fixture');
select lives_ok($$select public.join_rpg_pvp_match('00000000-0000-4000-8000-000000000002','room_test00001','apostol')$$,'join fixture');
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000001','room_test00001','20000000-0000-4000-8000-000000000001',1,'defend',null)$$,'an on-time turn still succeeds');
select is(public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000001','room_test00001','20000000-0000-4000-8000-000000000001',1,'defend',null)->>'duplicate','true','exact retry is idempotent');

-- This transaction began before the deadline. Wall time, not its start time,
-- must govern expiry. No Edge preflight/poll is involved.
select pg_sleep(0.05);
update public.pvp_matches set last_action_at=clock_timestamp()-interval '3 minutes'
where room_topic='room_test00001';
create temporary table deadline_result as
select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000002','room_test00001','20000000-0000-4000-8000-000000000002',2,'use_item','unknown-item') as result;
select is((select result->>'timed_out' from deadline_result),'true','direct action atomically expires the overdue turn');
select is((select status from public.pvp_matches where room_topic='room_test00001'),'completed','timeout persists instead of being rolled back by an exception');
select is((select winner_side from public.pvp_matches where room_topic='room_test00001'),'host','overdue guest loses');
select is((select count(*) from public.pvp_match_actions),1::bigint,'expired action never reaches the action ledger');
select is((select inventory from public.players where user_id='00000000-0000-4000-8000-000000000001'),'[{"id":"pvp-potato-1","name":"картофель"}]'::jsonb,'timeout leaves inventory intact');
select is(public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000001','room_test00001','20000000-0000-4000-8000-000000000001',1,'defend',null)->>'duplicate','true','original action can still replay after terminal timeout');
select throws_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000003','room_test00001','20000000-0000-4000-8000-000000000003',3,'attack',null)$$,'P0001','User is not a participant','outsider cannot adjudicate or act');
select ok(not has_function_privilege('authenticated','public.apply_rpg_pvp_action(uuid,text,uuid,bigint,text,text)','EXECUTE'),'direct browser action RPC stays denied');
select * from finish();
rollback;

