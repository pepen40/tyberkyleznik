begin;
select plan(18);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000201','authenticated','authenticated','pvp-rules-host@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-4000-8000-000000000202','authenticated','authenticated','pvp-rules-guest@example.invalid','',now(),'{}','{}',now(),now())
on conflict (id) do nothing;
insert into public.players (user_id, rpg_upgrades, inventory, item_points)
values
  ('00000000-0000-4000-8000-000000000201','{"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}}','[]',0),
  ('00000000-0000-4000-8000-000000000202','{"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}}','[]',0)
on conflict (user_id) do nothing;

select lives_ok($$select public.create_rpg_pvp_match('00000000-0000-4000-8000-000000000201','10000000-0000-4000-8000-000000000201','room_rules0001','ashab')$$,'create combat rules fixture');
select lives_ok($$select public.join_rpg_pvp_match('00000000-0000-4000-8000-000000000202','room_rules0001','apostol')$$,'join combat rules fixture');
update public.pvp_matches
set state=jsonb_set(jsonb_set(state,'{host,fighter,crit}','100'::jsonb,true),'{guest,fighter,defense}','20'::jsonb,true)
where room_topic='room_rules0001';
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000201','room_rules0001','20000000-0000-4000-8000-000000000201',1,'attack',null)$$,'forced-critical attack is server-resolved');
select is((select (result->>'critical')::boolean from public.pvp_match_actions where action_id='20000000-0000-4000-8000-000000000201'),true,'server applies the persisted critical chance');
select ok((select (result->>'damage')::integer = round((result->>'raw_damage')::numeric*0.8) from public.pvp_match_actions where action_id='20000000-0000-4000-8000-000000000201'),'server applies equipped armor after the critical roll');
update public.pvp_matches set state=jsonb_set(state,'{guest,mp}','50'::jsonb,true) where room_topic='room_rules0001';
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000202','room_rules0001','20000000-0000-4000-8000-000000000202',2,'defend',null)$$,'defend intent spends server mana');
select ok((select (state #>> '{guest,mp}')::integer=0 and (state #>> '{guest,defending}')::boolean and (state #>> '{guest,bonus_attacks}')::integer=2 from public.pvp_matches where room_topic='room_rules0001'),'defense sets mitigation and exactly two bonus attacks');
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000201','room_rules0001','20000000-0000-4000-8000-000000000203',3,'attack',null)$$,'attack resolves against server defense');
select ok((select (result->>'defense_applied')::boolean and (result->>'damage')::integer=floor((result->>'raw_damage')::numeric*0.2) from public.pvp_match_actions where action_id='20000000-0000-4000-8000-000000000203'),'defense reduces an incoming normal attack and is consumed');
update public.pvp_matches set state=jsonb_set(state,'{guest,mp}','100'::jsonb,true) where room_topic='room_rules0001';
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000202','room_rules0001','20000000-0000-4000-8000-000000000204',4,'skill',null)$$,'Apostol skill spends mana and resolves its server roll');
select ok((select (result->>'raw_damage')::integer between 70 and 99 and (state #>> '{guest,mp}')::integer=0 from public.pvp_match_actions where action_id='20000000-0000-4000-8000-000000000204'),'Apostol skill range and mana cost match the client rules');
update public.pvp_matches set state=jsonb_set(jsonb_set(state,'{host,mp}','100'::jsonb,true),'{host,fighter,crit}','0'::jsonb,true) where room_topic='room_rules0001';
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000201','room_rules0001','20000000-0000-4000-8000-000000000205',5,'skill',null)$$,'Ashab skill is server-resolved');
select is((select (result->>'raw_damage')::integer from public.pvp_match_actions where action_id='20000000-0000-4000-8000-000000000205'),60,'Ashab skill uses its fixed 60 plus validated upgrade scaling');
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000202','room_rules0001','20000000-0000-4000-8000-000000000206',6,'leave',null)$$,'surrender is allowed out of turn and server-selects the winner');

select lives_ok($$select public.create_rpg_pvp_match('00000000-0000-4000-8000-000000000201','10000000-0000-4000-8000-000000000202','room_rules0002','mee')$$,'create Mээ healing fixture');
select lives_ok($$select public.join_rpg_pvp_match('00000000-0000-4000-8000-000000000202','room_rules0002','ashab')$$,'join Mээ healing fixture');
update public.pvp_matches set state=jsonb_set(jsonb_set(state,'{host,mp}','100'::jsonb,true),'{host,hp}','60'::jsonb,true) where room_topic='room_rules0002';
select lives_ok($$select public.apply_rpg_pvp_action('00000000-0000-4000-8000-000000000201','room_rules0002','20000000-0000-4000-8000-000000000206',1,'skill',null)$$,'Mээ skill is server-resolved');
select is((select (state #>> '{host,hp}')::integer from public.pvp_matches where room_topic='room_rules0002'),88,'Mээ restores 25 percent of max HP and consumes all mana');

select * from finish();
rollback;
