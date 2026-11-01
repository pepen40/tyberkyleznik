begin;

create table if not exists public.realtime_room_access (
  topic text primary key,
  room_kind text not null check (room_kind in ('rpg','chess')),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_user_id uuid references auth.users(id) on delete cascade,
  guest_user_id uuid references auth.users(id) on delete cascade,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  check (guest_user_id is null or guest_user_id <> host_user_id),
  check (invitee_user_id is null or invitee_user_id <> host_user_id),
  check (room_kind = 'rpg' or is_public = false)
);

alter table public.realtime_room_access enable row level security;
revoke all on table public.realtime_room_access from public, anon, authenticated, service_role;

create or replace function public.register_realtime_room(
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
  v_uid uuid := auth.uid();
  v_invitee uuid;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Требуется авторизация.');
  end if;

  if p_kind = 'rpg' then
    if p_topic !~ '^room_[a-z0-9]{9}$' or (p_is_public is null) then
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
    if v_invitee = v_uid then
      return jsonb_build_object('success', false, 'error', 'Нельзя пригласить самого себя.');
    end if;
  end if;

  if p_kind = 'chess' and v_invitee is null then
    return jsonb_build_object('success', false, 'error', 'Для шахматной комнаты требуется приглашённый игрок.');
  end if;

  insert into public.realtime_room_access (
    topic, room_kind, host_user_id, invitee_user_id, is_public, expires_at
  ) values (
    p_topic, p_kind, v_uid, v_invitee,
    case when p_kind = 'rpg' then coalesce(p_is_public, false) else false end,
    now() + interval '2 hours'
  );

  return jsonb_build_object('success', true, 'topic', p_topic);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'Такой идентификатор комнаты уже используется.');
end;
$function$;

create or replace function public.join_realtime_room(p_topic text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_room public.realtime_room_access%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Требуется авторизация.');
  end if;

  select * into v_room
  from public.realtime_room_access
  where topic = p_topic and expires_at > now()
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Комната не найдена или срок её действия истёк.');
  end if;

  if v_room.host_user_id = v_uid or v_room.guest_user_id = v_uid then
    return jsonb_build_object('success', true, 'topic', p_topic);
  end if;

  if v_room.invitee_user_id is not null and v_room.invitee_user_id <> v_uid then
    return jsonb_build_object('success', false, 'error', 'Это приглашение предназначено другому игроку.');
  end if;

  if not v_room.is_public and v_room.invitee_user_id is null then
    return jsonb_build_object('success', false, 'error', 'У тебя нет приглашения в эту комнату.');
  end if;

  if v_room.guest_user_id is not null then
    return jsonb_build_object('success', false, 'error', 'В комнате уже есть второй игрок.');
  end if;

  update public.realtime_room_access
  set guest_user_id = v_uid
  where topic = p_topic and guest_user_id is null;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Не удалось занять место в комнате.');
  end if;

  return jsonb_build_object('success', true, 'topic', p_topic);
end;
$function$;

create or replace function public.can_access_realtime_topic(p_topic text)
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

revoke all on function public.register_realtime_room(text,text,text,boolean) from public, anon;
revoke all on function public.join_realtime_room(text) from public, anon;
revoke all on function public.can_access_realtime_topic(text) from public, anon;
grant execute on function public.register_realtime_room(text,text,text,boolean) to authenticated;
grant execute on function public.join_realtime_room(text) to authenticated;
grant execute on function public.can_access_realtime_topic(text) to authenticated;

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
    or public.can_access_realtime_topic(realtime.topic())
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
    or public.can_access_realtime_topic(realtime.topic())
  )
);

commit;
