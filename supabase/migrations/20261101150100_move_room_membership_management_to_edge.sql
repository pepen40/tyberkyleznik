begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_access_realtime_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.realtime_room_access r
    where r.topic = p_topic
      and r.expires_at > now()
      and auth.uid() is not null
      and (r.host_user_id = auth.uid() or r.guest_user_id = auth.uid())
  );
$function$;

revoke all on function private.can_access_realtime_topic(text) from public, anon;
grant execute on function private.can_access_realtime_topic(text) to authenticated;

drop policy if exists authenticated_realtime_receive_app_channels on realtime.messages;
drop policy if exists authenticated_realtime_send_app_channels on realtime.messages;

create policy authenticated_realtime_receive_app_channels
on realtime.messages
for select
to authenticated
using (
  (select auth.uid()) is not null
  and extension in ('broadcast', 'presence')
  and (
    realtime.topic() = any (array[
      'online-users',
      'pvp_lobby',
      'pepen40-global-chat',
      'chess-invitations'
    ]::text[])
    or private.can_access_realtime_topic(realtime.topic())
  )
);

create policy authenticated_realtime_send_app_channels
on realtime.messages
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and extension in ('broadcast', 'presence')
  and (
    realtime.topic() = any (array[
      'online-users',
      'pvp_lobby',
      'pepen40-global-chat',
      'chess-invitations'
    ]::text[])
    or private.can_access_realtime_topic(realtime.topic())
  )
);

-- Remove client-callable SECURITY DEFINER RPCs. Only the JWT-verifying Edge Function may manage memberships.
drop function if exists public.register_realtime_room(text, text, text, boolean);
drop function if exists public.join_realtime_room(text);
drop function if exists public.can_access_realtime_topic(text);

create or replace function public.register_realtime_room(
  p_user_id uuid,
  p_topic text,
  p_kind text,
  p_invitee_username text default null,
  p_is_public boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitee uuid;
begin
  if p_user_id is null or not exists(select 1 from auth.users u where u.id = p_user_id) then
    return jsonb_build_object('success', false, 'error', 'Недействительный владелец комнаты.');
  end if;

  if p_kind = 'rpg' then
    if p_topic !~ '^room_[a-z0-9]{9}$' or p_is_public is null then
      return jsonb_build_object('success', false, 'error', 'Некорректная RPG-комната.');
    end if;
  elsif p_kind = 'chess' then
    if p_topic !~ '^chess-room-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(p_is_public, false) then
      return jsonb_build_object('success', false, 'error', 'Некорректная шахматная комната.');
    end if;
  else
    return jsonb_build_object('success', false, 'error', 'Неизвестный тип комнаты.');
  end if;

  if nullif(trim(coalesce(p_invitee_username, '')), '') is not null then
    select pl.user_id into v_invitee
    from public.players pl
    where lower(pl.username) = lower(trim(p_invitee_username))
      and pl.user_id is not null
    limit 1;

    if v_invitee is null then
      return jsonb_build_object('success', false, 'error', 'Игрок для приглашения не найден.');
    end if;
    if v_invitee = p_user_id then
      return jsonb_build_object('success', false, 'error', 'Нельзя пригласить самого себя.');
    end if;
  end if;

  if p_kind = 'chess' and v_invitee is null then
    return jsonb_build_object('success', false, 'error', 'Для шахматной комнаты требуется приглашённый игрок.');
  end if;
  if p_kind = 'rpg' and coalesce(p_is_public, false) and v_invitee is not null then
    return jsonb_build_object('success', false, 'error', 'Публичная RPG-комната не может иметь персональное приглашение.');
  end if;
  if p_kind = 'rpg' and not coalesce(p_is_public, false) and v_invitee is null then
    return jsonb_build_object('success', false, 'error', 'Для закрытой RPG-комнаты требуется приглашённый игрок.');
  end if;

  insert into public.realtime_room_access (
    topic, room_kind, host_user_id, invitee_user_id, is_public, expires_at
  ) values (
    p_topic, p_kind, p_user_id, v_invitee,
    case when p_kind = 'rpg' then coalesce(p_is_public, false) else false end,
    now() + interval '2 hours'
  );

  return jsonb_build_object('success', true, 'topic', p_topic);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'Такой идентификатор комнаты уже используется.');
end;
$function$;

create or replace function public.join_realtime_room(
  p_user_id uuid,
  p_topic text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room public.realtime_room_access%rowtype;
begin
  if p_user_id is null or not exists(select 1 from auth.users u where u.id = p_user_id) then
    return jsonb_build_object('success', false, 'error', 'Недействительный игрок.');
  end if;

  select * into v_room
  from public.realtime_room_access
  where topic = p_topic and expires_at > now()
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Комната не найдена или срок её действия истёк.');
  end if;

  if v_room.host_user_id = p_user_id or v_room.guest_user_id = p_user_id then
    return jsonb_build_object('success', true, 'topic', p_topic);
  end if;

  if v_room.invitee_user_id is not null and v_room.invitee_user_id <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'Это приглашение предназначено другому игроку.');
  end if;

  if not v_room.is_public and v_room.invitee_user_id is null then
    return jsonb_build_object('success', false, 'error', 'У тебя нет приглашения в эту комнату.');
  end if;

  if v_room.guest_user_id is not null then
    return jsonb_build_object('success', false, 'error', 'В комнате уже есть второй игрок.');
  end if;

  update public.realtime_room_access
  set guest_user_id = p_user_id
  where topic = p_topic and guest_user_id is null;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Не удалось занять место в комнате.');
  end if;

  return jsonb_build_object('success', true, 'topic', p_topic);
end;
$function$;

revoke all on function public.register_realtime_room(uuid,text,text,text,boolean) from public, anon, authenticated;
revoke all on function public.join_realtime_room(uuid,text) from public, anon, authenticated;
grant execute on function public.register_realtime_room(uuid,text,text,text,boolean) to service_role;
grant execute on function public.join_realtime_room(uuid,text) to service_role;

commit;
