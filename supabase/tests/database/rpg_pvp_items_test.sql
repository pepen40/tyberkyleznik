begin;
select plan(15);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000101','authenticated','authenticated','pvp-items-host@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-4000-8000-000000000102','authenticated','authenticated','pvp-items-guest@example.invalid','',now(),'{}','{}',now(),now())
on conflict (id) do nothing;

insert into public.players (user_id, rpg_upgrades, inventory, item_points)
values
  ('00000000-0000-4000-8000-000000000101','{"ashab":{"hp":2000,"atk":0},"apostol":{"hp":2000,"atk":0},"mee":{"hp":2000,"atk":0}}',
   '[{"id":"item-heal","name":"хуйня"},{"id":"item-potato","name":"картофель"},{"id":"item-shaver","name":"Сбриватель хуйни"},{"id":"item-baran","name":"голова барана"},{"id":"item-apostol","name":"apostol"},{"id":"item-koala","name":"коала"},{"id":"item-boris","name":"boris"},{"id":"item-syringe","name":"шприц и лекарство"},{"id":"item-nothing","name":"Вам не повезло"},{"id":"item-parashnik","name":"парашник"}]',261),
  ('00000000-0000-4000-8000-000000000102','{"ashab":{"hp":10000,"atk":0},"apostol":{"hp":10000,"atk":0},"mee":{"hp":10000,"atk":0}}','[{"id":"guest-boris","name":"boris"}]',60)
on conflict (user_id) do update set inventory=excluded.inventory, item_points=excluded.item_points, rpg_upgrades=excluded.rpg_upgrades;

insert into public.realtime_room_access (topic, room_kind, host_user_id, guest_user_id, is_public, expires_at)
values ('room_items0001','rpg','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102',true,now()+interval '1 day');

create temporary table pvp_item_observations (item_name text primary key, state jsonb, result jsonb);

select lives_ok($$select public.create_rpg_pvp_match('00000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000101','room_items0001','mee')$$,'item test host match creation');
select lives_ok($$select public.join_rpg_pvp_match('00000000-0000-4000-8000-000000000102','room_items0001','ashab')$$,'item test guest join');

do $run_item_scenarios$
declare
  v_host constant uuid := '00000000-0000-4000-8000-000000000101';
  v_guest constant uuid := '00000000-0000-4000-8000-000000000102';
  v_version bigint := 1;
  v_index integer := 0;
  v_item record;
  v_result jsonb;
begin
  v_result := public.apply_rpg_pvp_action(v_host,'room_items0001',md5('items-host-open')::uuid,v_version,'attack',null);
  v_version := v_version + 1;
  v_result := public.apply_rpg_pvp_action(v_guest,'room_items0001',md5('items-guest-open')::uuid,v_version,'attack',null);
  v_version := v_version + 1;

  for v_item in
    select item->>'id' as item_id, item->>'name' as item_name
    from jsonb_array_elements((select inventory from public.players where user_id=v_host)) with ordinality as items(item,ordinality)
    order by ordinality
  loop
    v_result := public.apply_rpg_pvp_action(v_host,'room_items0001',md5('items-host-'||v_index)::uuid,v_version,'use_item',v_item.item_id);
    v_version := v_version + 1;
    insert into pvp_item_observations(item_name,state,result)
    values(v_item.item_name,v_result->'state',v_result);

    v_result := public.apply_rpg_pvp_action(v_host,'room_items0001',md5('items-host-attack-'||v_index)::uuid,v_version,'attack',null);
    v_version := v_version + 1;
    if v_index = 0 then
      v_result := public.apply_rpg_pvp_action(v_guest,'room_items0001',md5('items-guest-boris')::uuid,v_version,'use_item','guest-boris');
      v_version := v_version + 1;
    end if;
    v_result := public.apply_rpg_pvp_action(v_guest,'room_items0001',md5('items-guest-'||v_index)::uuid,v_version,'attack',null);
    v_version := v_version + 1;
    v_index := v_index + 1;
  end loop;
end;
$run_item_scenarios$;

select ok((select (state #>> '{host,hp}')::integer = (state #>> '{host,fighter,max_hp}')::integer from pvp_item_observations where item_name='хуйня'),'healing item restores the server-calculated maximum HP');
select ok((select (state #>> '{host,potato_buff}')::boolean from pvp_item_observations where item_name='картофель'),'potato sets the one-hit server buff');
select ok((select (state #>> '{guest,boris_hp}')::integer < 40031 from pvp_item_observations where item_name='Сбриватель хуйни'),'shaver removes half the opponent Boris shield');
select ok((select (state #>> '{guest,boris_hp}')::integer = 0 from pvp_item_observations where item_name='голова барана'),'ram head damages Boris using its max-HP percentage');
select ok((select (state #>> '{guest,hp}')::integer < (state #>> '{guest,fighter,max_hp}')::integer from pvp_item_observations where item_name='apostol'),'Apostol damage is based on server max HP');
select is((select (state #>> '{host,mp}')::integer from pvp_item_observations where item_name='коала'),100,'koala restores server mana');
select ok((select (state #>> '{host,boris_hp}')::integer > 0 from pvp_item_observations where item_name='boris'),'Boris shield is created from server max HP');
select ok((select (state #>> '{host,hp}')::integer = (state #>> '{host,fighter,max_hp}')::integer from pvp_item_observations where item_name='шприц и лекарство'),'syringe heals using the server maximum HP');
select is((select (result->>'damage')::integer from pvp_item_observations where item_name='Вам не повезло'),0,'empty-drop item consumes a turn with no effect');
select is((select (state #>> '{guest,parashnik_hp}')::integer from pvp_item_observations where item_name='парашник'),20,'Parashnik is deployed and its poison tick is calculated by the server');
select is((select jsonb_array_length(inventory) from public.players where user_id='00000000-0000-4000-8000-000000000101'),0,'all ten host items are consumed exactly once');
select is((select item_points from public.players where user_id='00000000-0000-4000-8000-000000000101'),0,'all consumed item points are removed atomically');
select is((select jsonb_array_length(inventory) from public.players where user_id='00000000-0000-4000-8000-000000000102'),0,'guest Boris item is consumed in the same match transaction');
select * from finish();
rollback;
