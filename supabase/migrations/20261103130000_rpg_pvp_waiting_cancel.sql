begin;

create or replace function public.cancel_rpg_pvp_match(
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
  if p_user_id is null or p_room_topic !~ '^room_[a-z0-9]{9}$' then
    raise exception 'Invalid PvP cancellation request';
  end if;

  select * into v_match
  from public.pvp_matches
  where room_topic = p_room_topic
  for update;

  if not found or v_match.host_user_id is distinct from p_user_id then
    raise exception 'Only the match host can cancel this room';
  end if;
  if v_match.status = 'cancelled' then
    return jsonb_build_object('success',true,'status','cancelled','version',v_match.version,'duplicate',true);
  end if;
  if v_match.status <> 'waiting' or v_match.guest_user_id is not null then
    raise exception 'Only a waiting PvP room can be cancelled';
  end if;

  update public.pvp_matches
  set status = 'cancelled', current_turn_side = null,
      completed_at = transaction_timestamp(), last_action_at = transaction_timestamp(),
      version = version + 1
  where match_id = v_match.match_id;

  return jsonb_build_object('success',true,'status','cancelled','version',v_match.version+1);
end;
$function$;

revoke all on function public.cancel_rpg_pvp_match(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.cancel_rpg_pvp_match(uuid,text) to service_role;

-- Prevent the legacy client-declared win RPC from remaining a reward path.
do $disable_legacy_pvp_result$
declare
  v_result_rpc regprocedure := to_regprocedure('public.apply_pvp_result(uuid,boolean)');
begin
  if v_result_rpc is not null then
    execute format('revoke all on function %s from public, anon, authenticated, service_role', v_result_rpc);
  end if;
end;
$disable_legacy_pvp_result$;

commit;
