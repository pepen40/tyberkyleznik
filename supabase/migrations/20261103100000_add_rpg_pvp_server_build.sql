-- PR2A: first server-authoritative RPG PvP build snapshot.
-- This migration deliberately does not expose match tables or enable rewards.
begin;

create or replace function public.build_rpg_pvp_fighter(
  p_user_id uuid,
  p_char_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_player public.players%rowtype;
  v_upgrades jsonb;
  v_gear jsonb;
  v_char_upgrades jsonb;
  v_equipped jsonb;
  v_item_id text;
  v_item jsonb;
  v_hp integer;
  v_atk integer;
  v_base_hp integer;
  v_base_atk integer;
  v_gear_hp integer := 0;
  v_gear_atk integer := 0;
  v_atk_percent integer := 0;
  v_crit integer := 0;
  v_defense integer := 0;
  v_expected_slot text;
  v_slot text;
begin
  if p_user_id is null or p_char_type not in ('ashab', 'apostol', 'mee') then
    raise exception 'Invalid fighter identity or character';
  end if;

  select * into v_player
  from public.players
  where user_id = p_user_id
  for share;

  if not found then
    raise exception 'Player profile not found';
  end if;

  v_upgrades := coalesce(v_player.rpg_upgrades, '{}'::jsonb);
  v_char_upgrades := coalesce(v_upgrades -> p_char_type, '{}'::jsonb);
  v_gear := coalesce(v_upgrades -> 'rpgGear', '{}'::jsonb);
  v_equipped := coalesce(v_gear -> 'equipped' -> p_char_type, '{}'::jsonb);

  v_base_hp := case p_char_type when 'ashab' then 150 when 'apostol' then 80 else 110 end;
  v_base_atk := case p_char_type when 'ashab' then 20 when 'apostol' then 30 else 18 end;

  for v_slot, v_item_id in
    select key, value
    from jsonb_each_text(v_equipped)
    where value is not null and value <> ''
  loop
    v_expected_slot := case
      when v_item_id in ('wood_blade','iron_edge','berserker_axe','void_blade') then 'weapon'
      when v_item_id in ('patched_vest','iron_plate','guardian_shell','abyss_armor') then 'armor'
      when v_item_id in ('lucky_charm','wolf_fang','phoenix_heart','king_relic') then 'charm'
      else null
    end;
    if v_expected_slot is null or v_slot <> v_expected_slot then
      raise exception 'Equipped gear is invalid for slot';
    end if;
    v_item := case v_item_id
      when 'wood_blade' then '{"atkPercent":6,"atk":0,"hp":0,"crit":0,"defense":0}'::jsonb
      when 'iron_edge' then '{"atkPercent":10,"atk":0,"hp":0,"crit":0,"defense":0}'::jsonb
      when 'berserker_axe' then '{"atkPercent":13,"atk":0,"hp":0,"crit":3,"defense":0}'::jsonb
      when 'void_blade' then '{"atkPercent":15,"atk":0,"hp":0,"crit":9,"defense":0}'::jsonb
      when 'patched_vest' then '{"atkPercent":0,"atk":0,"hp":25,"crit":0,"defense":3}'::jsonb
      when 'iron_plate' then '{"atkPercent":0,"atk":0,"hp":65,"crit":0,"defense":8}'::jsonb
      when 'guardian_shell' then '{"atkPercent":0,"atk":0,"hp":130,"crit":0,"defense":12}'::jsonb
      when 'abyss_armor' then '{"atkPercent":0,"atk":0,"hp":220,"crit":0,"defense":18}'::jsonb
      when 'lucky_charm' then '{"atkPercent":0,"atk":0,"hp":0,"crit":3,"defense":0}'::jsonb
      when 'wolf_fang' then '{"atkPercent":0,"atk":5,"hp":15,"crit":5,"defense":0}'::jsonb
      when 'phoenix_heart' then '{"atkPercent":0,"atk":0,"hp":50,"crit":0,"defense":0}'::jsonb
      when 'king_relic' then '{"atkPercent":0,"atk":12,"hp":80,"crit":8,"defense":5}'::jsonb
      else null
    end;
    if v_item is null then
      raise exception 'Unknown equipped gear item';
    end if;
    v_gear_hp := v_gear_hp + (v_item ->> 'hp')::integer;
    v_gear_atk := v_gear_atk + (v_item ->> 'atk')::integer;
    v_atk_percent := v_atk_percent + (v_item ->> 'atkPercent')::integer;
    v_crit := v_crit + (v_item ->> 'crit')::integer;
    v_defense := v_defense + (v_item ->> 'defense')::integer;
  end loop;

  if exists (
    select 1
    from jsonb_each_text(v_equipped) e(slot, item_id)
    where e.item_id <> ''
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(v_gear -> 'owned', '[]'::jsonb)) owned(item)
        where owned.item ->> 'id' = e.item_id
      )
  ) then
    raise exception 'Equipped gear is not owned';
  end if;

  v_hp := v_base_hp
    + greatest(0, least(10000, coalesce((v_char_upgrades ->> 'hp')::integer, 0))) * 20
    + v_gear_hp;
  v_atk := round((
      v_base_atk
      + greatest(0, least(10000, coalesce((v_char_upgrades ->> 'atk')::integer, 0))) * 5
      + v_gear_atk
    ) * (1 + v_atk_percent::numeric / 100));

  return jsonb_build_object(
    'user_id', p_user_id,
    'char_type', p_char_type,
    'max_hp', v_hp,
    'attack', greatest(1, v_atk),
    'upgrade_atk', greatest(0, least(10000, coalesce((v_char_upgrades ->> 'atk')::integer, 0))),
    'flat_atk', v_gear_atk,
    'atk_percent', least(50, v_atk_percent),
    'crit', least(50, v_crit),
    'defense', least(35, v_defense),
    'build_version', 1
  );
end;
$function$;

revoke all on function public.build_rpg_pvp_fighter(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.build_rpg_pvp_fighter(uuid, text) to service_role;

commit;
