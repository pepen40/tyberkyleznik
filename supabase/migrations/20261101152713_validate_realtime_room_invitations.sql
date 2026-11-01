begin;

create or replace function public.validate_realtime_room_invitation(
  p_user_id uuid,
  p_topic text,
  p_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_host_username text;
begin
  if p_user_id is null or p_topic is null or p_kind not in ('rpg','chess') then
    return jsonb_build_object('success', false, 'error', 'Некорректное приглашение.');
  end if;

  select p.username into v_host_username
  from public.realtime_room_access r
  join public.players p on p.user_id = r.host_user_id
  where r.topic = p_topic
    and r.room_kind = p_kind
    and r.invitee_user_id = p_user_id
    and r.expires_at > now()
  limit 1;

  if v_host_username is null then
    return jsonb_build_object('success', false, 'error', 'Приглашение недействительно или уже истекло.');
  end if;

  return jsonb_build_object(
    'success', true,
    'topic', p_topic,
    'kind', p_kind,
    'hostUsername', v_host_username
  );
end;
$function$;

revoke all on function public.validate_realtime_room_invitation(uuid,text,text) from public, anon, authenticated;
grant execute on function public.validate_realtime_room_invitation(uuid,text,text) to service_role;

commit;
