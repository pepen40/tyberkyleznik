-- PR2B: trusted PvP match creation, joining and participant-only snapshots.
begin;

create unique index pvp_matches_one_live_match_per_host
  on public.pvp_matches(host_user_id)
  where host_user_id is not null and status in ('waiting','active');
create unique index pvp_matches_one_live_match_per_guest
  on public.pvp_matches(guest_user_id)
  where guest_user_id is not null and status = 'active';

create or replace function public.create_rpg_pvp_match(
  p_user_id uuid,
  p_match_id uuid,
  p_room_topic text,
  p_char_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_build jsonb;
  v_state jsonb;
  v_old_match record;
begin
  if p_user_id is null or p_match_id is null
     or p_room_topic !~ '^room_[a-z0-9]{9}$'
     or p_char_type not in ('ashab','apostol','mee') then
    raise exception 'Invalid match creation request';
  end if;

  perform 1
  from public.realtime_room_access
  where topic = p_room_topic
    and room_kind = 'rpg'
    and host_user_id = p_user_id
    and expires_at > transaction_timestamp()
  for update;
  if not found then raise exception 'User is not an authorized RPG room participant'; end if;

  -- Reconcile this user's abandoned turns before enforcing the one-live-match rule.
  for v_old_match in
    select room_topic
    from public.pvp_matches
    where (host_user_id = p_user_id or guest_user_id = p_user_id)
      and ((status = 'waiting' and last_action_at <= transaction_timestamp() - interval '10 minutes')
        or (status = 'active' and last_action_at <= transaction_timestamp() - interval '3 minutes'))
  loop
    perform public.expire_rpg_pvp_turn(p_user_id, v_old_match.room_topic);
  end loop;

  if exists (
    select 1 from public.pvp_matches
    where status in ('waiting','active')
      and (host_user_id = p_user_id or guest_user_id = p_user_id)
  ) then
    raise exception 'Player already has a live PvP match';
  end if;

  v_build := public.build_rpg_pvp_fighter(p_user_id, p_char_type);
  v_state := jsonb_build_object(
    'host', jsonb_build_object(
      'fighter', v_build, 'hp', (v_build->>'max_hp')::integer,
      'mp', 0, 'boris_hp', 0, 'parashnik_hp', 0,
      'defending', false, 'potato_buff', false,
      'bonus_attacks', 0, 'item_used', false
    ),
    'guest', null
  );

  insert into public.pvp_matches(
    match_id, room_topic, host_user_id, status, current_turn_side,
    version, server_builds_version, state_format_version, ruleset_version,
    server_builds, state
  ) values (
    p_match_id, p_room_topic, p_user_id, 'waiting', null,
    0, 1, 1, 1,
    jsonb_build_object('host',v_build,'guest',null),
    v_state
  );

  return jsonb_build_object('success',true,'match_id',p_match_id,'status','waiting','version',0);
end;
$function$;

create or replace function public.join_rpg_pvp_match(
  p_user_id uuid,
  p_room_topic text,
  p_char_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_match public.pvp_matches%rowtype;
  v_build jsonb;
  v_guest jsonb;
  v_host jsonb;
  v_expiry jsonb;
begin
  if p_user_id is null or p_room_topic !~ '^room_[a-z0-9]{9}$'
     or p_char_type not in ('ashab','apostol','mee') then
    raise exception 'Invalid match join request';
  end if;

  perform 1
  from public.realtime_room_access
  where topic = p_room_topic
    and room_kind = 'rpg'
    and guest_user_id = p_user_id
    and host_user_id is not null
    and expires_at > transaction_timestamp()
  for update;
  if not found then raise exception 'User is not an authorized RPG room participant'; end if;

  select * into v_match
  from public.pvp_matches
  where room_topic = p_room_topic
  for update;

  if not found or v_match.status <> 'waiting' or v_match.host_user_id = p_user_id then
    raise exception 'Match is unavailable';
  end if;
  if v_match.host_user_id is null then
    update public.pvp_matches
    set status='cancelled', completed_at=transaction_timestamp(), last_action_at=transaction_timestamp(), version=version+1
    where match_id=v_match.match_id;
    return jsonb_build_object('success',false,'error','Match host account was deleted');
  end if;
  if v_match.last_action_at <= transaction_timestamp() - interval '10 minutes' then
    v_expiry := public.expire_rpg_pvp_turn(v_match.host_user_id, p_room_topic);
    return jsonb_build_object('success',false,'error','Match is unavailable','expired',true);
  end if;
  if exists (
    select 1 from public.pvp_matches
    where status in ('waiting','active')
      and (host_user_id = p_user_id or guest_user_id = p_user_id)
  ) then
    raise exception 'Player already has a live PvP match';
  end if;

  v_build := public.build_rpg_pvp_fighter(p_user_id, p_char_type);
  v_guest := jsonb_build_object(
    'fighter',v_build,'hp',(v_build->>'max_hp')::integer,
    'mp',0,'boris_hp',0,'parashnik_hp',0,
    'defending',false,'potato_buff',false,
    'bonus_attacks',0,'item_used',false
  );
  v_host := v_match.state->'host';

  update public.pvp_matches
  set guest_user_id = p_user_id,
      status = 'active',
      current_turn_side = 'host',
      started_at = transaction_timestamp(),
      last_action_at = transaction_timestamp(),
      version = version + 1,
      server_builds = jsonb_set(server_builds,'{guest}',v_build,true),
      state = jsonb_set(state,'{guest}',v_guest,true)
  where match_id = v_match.match_id;

  return jsonb_build_object(
    'success',true,'match_id',v_match.match_id,'status','active',
    'version',v_match.version + 1,'state',jsonb_build_object('host',v_host,'guest',v_guest),
    'current_turn_side','host'
  );
end;
$function$;

create or replace function public.get_rpg_pvp_match(
  p_user_id uuid,
  p_room_topic text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_match public.pvp_matches%rowtype;
begin
  select * into v_match
  from public.pvp_matches
  where room_topic = p_room_topic
    and (host_user_id = p_user_id or guest_user_id = p_user_id);

  if not found then
    raise exception 'Match not found for participant';
  end if;

  return jsonb_build_object(
    'success',true,'match_id',v_match.match_id,'status',v_match.status,
    'version',v_match.version,'current_turn_side',v_match.current_turn_side,
    'state',v_match.state,'server_builds',v_match.server_builds,
    'winner_side',v_match.winner_side
  );
end;
$function$;

revoke all on function public.create_rpg_pvp_match(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.join_rpg_pvp_match(uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.get_rpg_pvp_match(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.create_rpg_pvp_match(uuid,uuid,text,text) to service_role;
grant execute on function public.join_rpg_pvp_match(uuid,text,text) to service_role;
grant execute on function public.get_rpg_pvp_match(uuid,text) to service_role;

commit;
