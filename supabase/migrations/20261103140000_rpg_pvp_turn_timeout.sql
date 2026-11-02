begin;

create or replace function public.expire_rpg_pvp_turn(
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
  v_timed_out_side text;
  v_winner_side text;
  v_terminal_status text;
begin
  if p_user_id is null or p_room_topic !~ '^room_[a-z0-9]{9}$' then
    raise exception 'Invalid PvP timeout request';
  end if;

  select * into v_match
  from public.pvp_matches
  where room_topic = p_room_topic
    and (host_user_id = p_user_id or guest_user_id = p_user_id)
  for update;

  if not found then raise exception 'Match not found for participant'; end if;

  if v_match.status = 'active' and (v_match.host_user_id is null or v_match.guest_user_id is null) then
    v_timed_out_side := case when v_match.host_user_id is null then 'host' else 'guest' end;
    v_winner_side := case when v_match.host_user_id is null and v_match.guest_user_id is null then null
                          when v_timed_out_side = 'host' then 'guest' else 'host' end;
    v_terminal_status := case when v_winner_side is null then 'cancelled' else 'completed' end;
  elsif v_match.status = 'active'
        and v_match.last_action_at <= transaction_timestamp() - interval '3 minutes' then
    v_timed_out_side := v_match.current_turn_side;
    if v_timed_out_side not in ('host','guest') then raise exception 'Active match has no current turn'; end if;
    v_winner_side := case when v_timed_out_side = 'host' then 'guest' else 'host' end;
    v_terminal_status := 'completed';
  elsif v_match.status = 'waiting' and v_match.host_user_id is null then
    v_terminal_status := 'cancelled';
  elsif v_match.status = 'waiting'
        and v_match.last_action_at <= transaction_timestamp() - interval '10 minutes' then
    v_terminal_status := 'expired';
  else
    v_terminal_status := null;
  end if;

  if v_terminal_status is not null then
    update public.pvp_matches
    set status = v_terminal_status, winner_side = v_winner_side, current_turn_side = null,
        completed_at = transaction_timestamp(), last_action_at = transaction_timestamp(),
        version = version + 1
    where match_id = v_match.match_id;
    return jsonb_build_object(
      'success',true,'timed_out',true,'timed_out_side',v_timed_out_side,
      'participant_deleted',v_match.host_user_id is null or (v_match.status='active' and v_match.guest_user_id is null),
      'status',v_terminal_status,'winner_side',v_winner_side,'version',v_match.version+1,
      'match_id',v_match.match_id,'state',v_match.state
    );
  end if;

  return jsonb_build_object(
    'success',true,'timed_out',false,'status',v_match.status,
    'version',v_match.version,'match_id',v_match.match_id
  );
end;
$function$;

revoke all on function public.expire_rpg_pvp_turn(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.expire_rpg_pvp_turn(uuid,text) to service_role;

commit;
