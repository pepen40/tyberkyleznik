-- PR2C: atomic server-resolved combat turns (attack, defend, class skill).
begin;

create or replace function public.apply_rpg_pvp_action(
  p_user_id uuid,
  p_room_topic text,
  p_action_id uuid,
  p_expected_version bigint,
  p_action_kind text,
  p_item_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_match public.pvp_matches%rowtype;
  v_side text;
  v_enemy_side text;
  v_actor jsonb;
  v_enemy jsonb;
  v_actor_build jsonb;
  v_enemy_build jsonb;
  v_command jsonb;
  v_old_action public.pvp_match_actions%rowtype;
  v_damage integer := 0;
  v_raw integer := 0;
  v_mana_gain integer := 0;
  v_crit boolean := false;
  v_target text := 'player';
  v_defense_applied boolean := false;
  v_armor_applied boolean := false;
  v_bonus boolean := false;
  v_result jsonb;
  v_winner text;
  v_roll integer;
begin
  if p_user_id is null or p_action_id is null or p_room_topic is null
     or p_expected_version is null or p_action_kind not in ('attack','defend','skill','use_item','leave') then
    raise exception 'Invalid PvP action';
  end if;

  select * into v_match
  from public.pvp_matches
  where room_topic = p_room_topic
  for update;

  if not found then raise exception 'Match not found'; end if;

  select * into v_old_action
  from public.pvp_match_actions
  where match_id = v_match.match_id and action_id = p_action_id;

  v_command := jsonb_build_object('kind',p_action_kind,'item_id',p_item_id);
  if found then
    if v_old_action.actor_user_id = p_user_id and v_old_action.command = v_command then
      return v_old_action.result || jsonb_build_object('duplicate',true);
    end if;
    raise exception 'Idempotency key reused with different command';
  end if;

  if v_match.status <> 'active' then raise exception 'Match is not active'; end if;
  if v_match.version <> p_expected_version then raise exception 'Stale match version'; end if;

  v_side := case
    when v_match.host_user_id = p_user_id then 'host'
    when v_match.guest_user_id = p_user_id then 'guest'
    else null end;
  if v_side is null then raise exception 'User is not a participant'; end if;
  if v_side <> v_match.current_turn_side then raise exception 'Not your turn'; end if;
  v_enemy_side := case when v_side='host' then 'guest' else 'host' end;
  v_actor := v_match.state -> v_side;
  v_enemy := v_match.state -> v_enemy_side;
  v_actor_build := v_actor -> 'fighter';
  v_enemy_build := v_enemy -> 'fighter';

  if p_action_kind = 'leave' then
    v_winner := v_enemy_side;
    update public.pvp_matches set status='completed', winner_side=v_winner,
      completed_at=transaction_timestamp(), current_turn_side=null,
      version=version+1, last_action_at=transaction_timestamp()
    where match_id=v_match.match_id;
    v_result := jsonb_build_object('success',true,'status','completed','winner_side',v_winner,
      'version',v_match.version+1,'state',v_match.state);
  elsif p_action_kind = 'use_item' then
    raise exception 'Item actions are not enabled until atomic inventory effects are installed';
  elsif p_action_kind = 'attack' then
    v_roll := floor(random()*10)::integer;
    v_raw := (v_actor_build->>'attack')::integer + v_roll;
    v_crit := random()*100 < coalesce((v_actor_build->>'crit')::numeric,0);
    if v_crit then v_raw := round(v_raw*1.75); end if;
    if coalesce((v_actor->>'potato_buff')::boolean,false) then
      v_raw := round(v_raw*1.15);
      v_actor := jsonb_set(v_actor,'{potato_buff}','false'::jsonb,true);
    end if;
    if coalesce((v_actor->>'parashnik_hp')::integer,0)>0 then
      v_target := 'ownParashnik';
      v_actor := jsonb_set(v_actor,'{parashnik_hp}',to_jsonb(greatest(0,(v_actor->>'parashnik_hp')::integer-v_raw)),true);
      v_damage := v_raw;
    elsif coalesce((v_enemy->>'defending')::boolean,false) then
      v_damage := floor(v_raw*0.2)::integer;
      v_enemy := jsonb_set(v_enemy,'{defending}','false'::jsonb,true);
      v_enemy := jsonb_set(v_enemy,'{hp}',to_jsonb((v_enemy->>'hp')::integer-v_damage),true);
      v_defense_applied := true;
    elsif coalesce((v_enemy->>'boris_hp')::integer,0)>0 then
      v_damage := v_raw;
      v_enemy := jsonb_set(v_enemy,'{boris_hp}',to_jsonb(greatest(0,(v_enemy->>'boris_hp')::integer-v_damage)),true);
      v_target := 'boris';
    else
      v_damage := greatest(1,round(v_raw*(1-coalesce((v_enemy_build->>'defense')::numeric,0)/100)));
      v_enemy := jsonb_set(v_enemy,'{hp}',to_jsonb((v_enemy->>'hp')::integer-v_damage),true);
      v_armor_applied := v_damage < v_raw;
    end if;
    v_mana_gain := case when v_actor_build->>'char_type'='apostol' then 20 else 15 end;
    v_actor := jsonb_set(v_actor,'{mp}',to_jsonb(least(100,(v_actor->>'mp')::integer+v_mana_gain)),true);
    if coalesce((v_actor->>'bonus_attacks')::integer,0)>0 then
      v_actor := jsonb_set(v_actor,'{bonus_attacks}',to_jsonb((v_actor->>'bonus_attacks')::integer-1),true);
    end if;
    v_bonus := coalesce((v_actor->>'bonus_attacks')::integer,0)>0;
  elsif p_action_kind = 'defend' then
    if (v_actor->>'mp')::integer < 50 then raise exception 'Not enough mana'; end if;
    v_actor := jsonb_set(v_actor,'{mp}',to_jsonb((v_actor->>'mp')::integer-50),true);
    v_actor := jsonb_set(v_actor,'{defending}','true'::jsonb,true);
    v_actor := jsonb_set(v_actor,'{bonus_attacks}','2'::jsonb,true);
  elsif p_action_kind = 'skill' then
    if (v_actor->>'mp')::integer < 100 then raise exception 'Not enough mana'; end if;
    v_actor := jsonb_set(v_actor,'{mp}','0'::jsonb,true);
    v_actor := jsonb_set(v_actor,'{bonus_attacks}','0'::jsonb,true);
    if v_actor_build->>'char_type'='ashab' then
      v_raw := 60 + coalesce((v_actor_build->>'upgrade_atk')::integer,0)*10;
    elsif v_actor_build->>'char_type'='apostol' then
      v_raw := 70 + floor(random()*30)::integer + coalesce((v_actor_build->>'upgrade_atk')::integer,0)*10;
    else
      v_damage := round((v_actor_build->>'max_hp')::numeric*0.25);
      v_actor := jsonb_set(v_actor,'{hp}',to_jsonb(least((v_actor_build->>'max_hp')::integer,(v_actor->>'hp')::integer+v_damage)),true);
      v_raw := 0;
    end if;
    if v_raw>0 then
      v_raw := round((v_raw+coalesce((v_actor_build->>'flat_atk')::integer,0))*(1+coalesce((v_actor_build->>'atk_percent')::numeric,0)/100));
      v_crit := random()*100 < coalesce((v_actor_build->>'crit')::numeric,0);
      if v_crit then v_raw := round(v_raw*1.75); end if;
      if coalesce((v_actor->>'parashnik_hp')::integer,0)>0 then
        v_target := 'ownParashnik';
        v_actor := jsonb_set(v_actor,'{parashnik_hp}',to_jsonb(greatest(0,(v_actor->>'parashnik_hp')::integer-v_raw)),true);
        v_damage := v_raw;
      elsif coalesce((v_enemy->>'defending')::boolean,false) then
        v_damage := floor(v_raw*0.5)::integer;
        v_enemy := jsonb_set(v_enemy,'{defending}','false'::jsonb,true);
        v_enemy := jsonb_set(v_enemy,'{hp}',to_jsonb((v_enemy->>'hp')::integer-v_damage),true);
        v_defense_applied := true;
      elsif coalesce((v_enemy->>'boris_hp')::integer,0)>0 then
        v_damage := v_raw;
        v_enemy := jsonb_set(v_enemy,'{boris_hp}',to_jsonb(greatest(0,(v_enemy->>'boris_hp')::integer-v_damage)),true);
        v_target := 'boris';
      else
        v_damage := greatest(1,round(v_raw*(1-coalesce((v_enemy_build->>'defense')::numeric,0)/100)));
        v_enemy := jsonb_set(v_enemy,'{hp}',to_jsonb((v_enemy->>'hp')::integer-v_damage),true);
        v_armor_applied := v_damage < v_raw;
      end if;
    end if;
  end if;

  if p_action_kind <> 'leave' then
    if (v_enemy->>'hp')::integer <= 0 then v_winner := v_side;
    elsif (v_actor->>'hp')::integer <= 0 then v_winner := v_enemy_side;
    end if;
    update public.pvp_matches
    set state=jsonb_set(jsonb_set(state,array[v_side],v_actor,true),array[v_enemy_side],v_enemy,true),
        status=case when v_winner is null then 'active' else 'completed' end,
        winner_side=v_winner,
        completed_at=case when v_winner is null then null else transaction_timestamp() end,
        current_turn_side=case when v_winner is not null then null when v_bonus then v_side else v_enemy_side end,
        version=version+1,last_action_at=transaction_timestamp()
    where match_id=v_match.match_id;
    v_result := jsonb_build_object(
      'success',true,'action',p_action_kind,'damage',v_damage,'raw_damage',v_raw,
      'critical',v_crit,'target',v_target,'defense_applied',v_defense_applied,
      'armor_applied',v_armor_applied,'status',case when v_winner is null then 'active' else 'completed' end,
      'winner_side',v_winner,'current_turn_side',case when v_winner is not null then null when v_bonus then v_side else v_enemy_side end,
      'version',v_match.version+1,
      'state',jsonb_set(jsonb_set(v_match.state,array[v_side],v_actor,true),array[v_enemy_side],v_enemy,true)
    );
  end if;

  insert into public.pvp_match_actions(
    match_id,action_id,actor_user_id,actor_side,action_kind,command,
    version_before,version_after,result
  ) values (
    v_match.match_id,p_action_id,p_user_id,v_side,p_action_kind,v_command,
    v_match.version,v_match.version+1,v_result
  );
  return v_result;
end;
$function$;

revoke all on function public.apply_rpg_pvp_action(uuid,text,uuid,bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function public.apply_rpg_pvp_action(uuid,text,uuid,bigint,text,text) to service_role;

commit;
