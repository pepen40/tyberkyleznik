begin;

create or replace function public.get_rpg_invitation_peer(
  p_user_id uuid,
  p_topic text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_peer_id uuid;
  v_peer_username text;
begin
  if p_user_id is null
     or p_topic !~ '^room_[a-z0-9]{9}$'
     or p_role not in ('host', 'invitee') then
    return jsonb_build_object('success', false, 'error', 'Invalid RPG invitation.');
  end if;

  select peer.user_id, peer.username
    into v_peer_id, v_peer_username
  from public.realtime_room_access r
  join public.players peer
    on peer.user_id = case when p_role = 'host' then r.invitee_user_id else r.host_user_id end
  where r.topic = p_topic
    and r.room_kind = 'rpg'
    and r.expires_at > now()
    and ((p_role = 'host' and r.host_user_id = p_user_id and r.invitee_user_id is not null)
      or (p_role = 'invitee' and r.invitee_user_id = p_user_id));

  if v_peer_id is null then
    return jsonb_build_object('success', false, 'error', 'RPG invitation is unavailable.');
  end if;

  return jsonb_build_object(
    'success', true,
    'peerUserId', v_peer_id,
    'peerUsername', v_peer_username
  );
end;
$function$;

revoke all on function public.get_rpg_invitation_peer(uuid,text,text) from public, anon, authenticated;
grant execute on function public.get_rpg_invitation_peer(uuid,text,text) to service_role;

create or replace function public.close_rpg_invitation(
  p_user_id uuid,
  p_topic text,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_user_id is null
     or p_topic !~ '^room_[a-z0-9]{9}$'
     or p_role not in ('host', 'invitee') then
    return false;
  end if;

  update public.realtime_room_access
  set expires_at = now()
  where topic = p_topic
    and room_kind = 'rpg'
    and expires_at > now()
    and ((p_role = 'host' and host_user_id = p_user_id)
      or (p_role = 'invitee' and invitee_user_id = p_user_id));

  return found;
end;
$function$;

revoke all on function public.close_rpg_invitation(uuid,text,text) from public, anon, authenticated;
grant execute on function public.close_rpg_invitation(uuid,text,text) to service_role;

drop policy if exists authenticated_receive_own_rpg_invitation_inbox on realtime.messages;
create policy authenticated_receive_own_rpg_invitation_inbox
on realtime.messages
for select
to authenticated
using (
  (select auth.uid()) is not null
  and realtime.topic() = 'rpg-invitations:' || (select auth.uid())::text
  and extension = 'broadcast'
);

commit;
