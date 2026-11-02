begin;
select plan(37);

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
  ('room_test00001','rpg','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',true,now()+interval '1 day'),
  ('room_delete001','rpg','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',true,now()+interval '1 day');

select throws_ok($$select public.create_rpg_pvp_match('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','room_badchar01','wizard')$$,'P0001',null,'invalid fighter identity is rejected by the server build');
select throws_ok($$select public.create_rpg_pvp_match('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','room_unreg0001','ashab')$$,'P0001','User is not an authorized RPG room participant','host cannot create a PvP match for an unregistered room');
select throws_ok($$select public.create_rpg_pvp_match('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000011','room_test00001','ashab')$$,'P0001','User is not an authorized RPG room participant','another user cannot create a PvP match for the room host');
select lives_ok($$select public.create_rpg_pvp_match('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','room_stale0001','ashab')$$,'create abandoned waiting-room fixture');
update public.pvp_matches set last_action_at=transaction_timestamp()-interval '11 minutes' where room_topic='room_stale0001';
select lives_ok($$select public.create_rpg_pvp_match('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','room_test00001','ashab')$$,'host creates a server-built waiting match');
select is((select status from public.pvp_matches where room_topic='room_stale0001'),'expired','server expires the host’s abandoned waiting room before a new match');
select throws_ok($$select public.join_rpg_pvp_match('00000000-0000-4000-8000-000000000003','room_test00001','mee')$$,'P0001','User is not an authorized RPG room participant','a non-room-member cannot join an RPG PvP match');
select lives_ok($$select public.join_rpg_pvp_match('00000000-0000-4000-8000-000000000002','room_test00001','apostol')$$,'second participant joins and server starts the match');
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000001','room_test00001','20000000-0000-4000-8000-000000000001',1,'attack',null)$$,'current participant can submit an attack intent');
select is(public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000001','room_test00001','20000000-0000-4000-8000-000000000001',1,'attack',null)->>'duplicate','true','same participant and exact action retry returns its original result');
select throws_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000001','room_test00001','20000000-0000-4000-8000-000000000001',1,'defend',null)$$,'P0001',null,'reusing an action id with a different command is rejected');
select throws_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000003','room_test00001','20000000-0000-4000-8000-000000000002',2,'attack',null)$$,'P0001',null,'nonparticipant cannot act');
select throws_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000002','room_test00001','20000000-0000-4000-8000-000000000003',1,'attack',null)$$,'P0001',null,'stale state version is rejected');
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000002','room_test00001','20000000-0000-4000-8000-000000000004',2,'attack',null)$$,'the opponent acts only after the server advances the turn');
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000001','room_test00001','20000000-0000-4000-8000-000000000005',3,'use_item','pvp-potato-1')$$,'owned item consumption and effect execute in the match transaction');
select is((select jsonb_array_length(inventory) from public.players where user_id='00000000-0000-4000-8000-000000000001'),0,'item is removed from inventory exactly once');
select is((select item_points from public.players where user_id='00000000-0000-4000-8000-000000000001'),0,'consuming the item atomically removes its score value');
select is((select (state #>> '{host,potato_buff}')::boolean from public.pvp_matches where room_topic='room_test00001'),true,'potato buff is persisted in server match state');
select throws_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000002','room_test00001','20000000-0000-4000-8000-000000000007',4,'use_item','pvp-potato-1')$$,'P0001',null,'a player cannot consume an opponent inventory item');
select throws_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000002','room_test00001','20000000-0000-4000-8000-000000000005',3,'use_item','pvp-potato-1')$$,'P0001',null,'another participant cannot retrieve the original action result');
select throws_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000002','room_test00001','20000000-0000-4000-8000-000000000006',4,'attack',null)$$,'P0001',null,'action outside the participant turn is rejected');
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000001','room_test00001','20000000-0000-4000-8000-000000000009',4,'attack',null)$$,'item use preserves the actor turn so the player can attack afterward');
select is((select status from public.pvp_matches where room_topic='room_test00001'),'active','client action did not complete the match');
select is((select version from public.pvp_matches where room_topic='room_test00001'),5::bigint,'each accepted action advances exactly one server version');
select ok(not (select proargnames && array['damage','winner','hp','mana','result']::text[] from pg_proc where oid='public.apply_rpg_pvp_action(uuid,text,uuid,bigint,text,text)'::regprocedure),'RPC accepts no client-supplied combat results');
update public.pvp_matches set last_action_at = transaction_timestamp() - interval '4 minutes' where room_topic='room_test00001';
select lives_ok($$select public.expire_rpg_pvp_turn('00000000-0000-4000-8000-000000000001','room_test00001')$$,'server expires an inactive turn using server time');
select is((select status from public.pvp_matches where room_topic='room_test00001'),'completed','turn timeout completes the match');
select is((select winner_side from public.pvp_matches where room_topic='room_test00001'),'host','server awards the timeout result against the timed-out turn');
select lives_ok($$select public.create_rpg_pvp_match('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','room_delete001','ashab')$$,'create match for Auth deletion history test');
select lives_ok($$select public.join_rpg_pvp_match('00000000-0000-4000-8000-000000000002','room_delete001','mee')$$,'join match for Auth deletion history test');
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000001','room_delete001','20000000-0000-4000-8000-000000000008',1,'attack',null)$$,'record action before Auth deletion');
select lives_ok($$delete from auth.users where id='00000000-0000-4000-8000-000000000001'$$,'delete Auth account inside the isolated test transaction');
select lives_ok($$select public.expire_rpg_pvp_turn('00000000-0000-4000-8000-000000000002','room_delete001')$$,'surviving participant triggers safe server cancellation after account deletion');
select is((select status from public.pvp_matches where room_topic='room_delete001'),'completed','deleted participant match completes without deleting history');
select is((select winner_side from public.pvp_matches where room_topic='room_delete001'),'guest','remaining participant wins after opponent account deletion');
select is((select count(*)::integer from public.pvp_match_actions a join public.pvp_matches m using(match_id) where m.room_topic='room_delete001'),1,'action audit row survives Auth user deletion');
select is((select count(*)::integer from public.pvp_match_actions a join public.pvp_matches m using(match_id) where m.room_topic='room_delete001' and a.actor_user_id is null),1,'deleted action actor is anonymized with SET NULL');

select * from finish();
rollback;
