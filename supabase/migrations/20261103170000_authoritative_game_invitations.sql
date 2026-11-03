-- Server-owned invitation lifecycle. No existing rows or users are removed.
begin;
create table public.game_invitation_preferences (
  -- Retain settings as history on Auth deletion; commands verify a live user.
  user_id uuid primary key,
  rpg boolean not null default true,
  chess boolean not null default true
);
create table public.game_invitations (
  topic text primary key references public.realtime_room_access(topic),
  kind text not null check(kind in ('rpg','chess')),
  host_id uuid references auth.users(id) on delete set null,
  invitee_id uuid references auth.users(id) on delete set null,
  status text not null check(status in ('pending','received','accepted','declined','disabled','busy','cancelled','expired')),
  expires_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp(),
  check(host_id <> invitee_id)
);
create index game_invitations_recipient on public.game_invitations(invitee_id,updated_at desc);
create index game_invitations_sender on public.game_invitations(host_id,updated_at desc);
alter table public.game_invitations enable row level security;
alter table public.game_invitation_preferences enable row level security;
revoke all on public.game_invitations, public.game_invitation_preferences from public,anon,authenticated,service_role;

create or replace function public.game_invitation_command(
  p_user_id uuid, p_op text, p_topic text default '', p_value text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  r public.realtime_room_access%rowtype;
  i public.game_invitations%rowtype;
  prefs public.game_invitation_preferences%rowtype;
  v_now timestamptz;
  v_json jsonb;
  v_join jsonb;
  v_status text;
begin
  if p_user_id is null or not exists(select 1 from auth.users where id=p_user_id) then
    raise exception 'Invitation authorization required';
  end if;
  if p_op = 'settings' then
    if p_value <> '' then
      v_json := p_value::jsonb;
      if jsonb_typeof(v_json->'rpg') <> 'boolean' or jsonb_typeof(v_json->'chess') <> 'boolean'
         or not (v_json ? 'rpg' and v_json ? 'chess') then raise exception 'Invalid invitation settings'; end if;
      insert into public.game_invitation_preferences(user_id,rpg,chess)
      values(p_user_id,(v_json->>'rpg')::boolean,(v_json->>'chess')::boolean)
      on conflict(user_id) do update set rpg=excluded.rpg,chess=excluded.chess;
    end if;
    select * into prefs from public.game_invitation_preferences where user_id=p_user_id;
    return jsonb_build_object('success',true,'rpg',coalesce(prefs.rpg,true),'chess',coalesce(prefs.chess,true));
  end if;
  if p_op = 'list' then
    -- Filtering precedes projection: no other user's invitation or email is exposed.
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_json from (
      select g.topic,g.kind,g.host_id,g.invitee_id,
        case when g.status in ('pending','received') and g.expires_at<=clock_timestamp() then 'expired' else g.status end as status,
        g.expires_at, host.username as host, guest.username as invitee
      from public.game_invitations g
      join public.players host on host.user_id=g.host_id
      join public.players guest on guest.user_id=g.invitee_id
      where p_user_id in (g.host_id,g.invitee_id)
      order by g.updated_at desc limit 64
    ) x;
    return jsonb_build_object('success',true,'invitations',v_json,'server_now',clock_timestamp());
  end if;
  if p_op not in ('create','read','reply','cancel') or p_op is null then raise exception 'Invalid invitation command'; end if;
  -- All room/ledger changes use the same order: room first, invitation second.
  select * into r from public.realtime_room_access where topic=p_topic for update;
  if not found or
     (r.host_user_id is distinct from p_user_id and r.invitee_user_id is distinct from p_user_id) then
    raise exception 'Invitation is unavailable';
  end if;
  if r.room_kind not in ('rpg','chess') or r.invitee_user_id is null then raise exception 'Invalid invitation room'; end if;
  select * into i from public.game_invitations where topic=p_topic for update;
  v_now := clock_timestamp();
  if p_op='create' and i.topic is null then
    if r.host_user_id<>p_user_id or r.expires_at<=v_now then raise exception 'Invitation is unavailable'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('game-invitations:'||p_user_id::text,0));
    if (select count(*) from public.game_invitations where host_id=p_user_id and status in ('pending','received') and expires_at>v_now)>=10 then
      raise exception 'Too many pending invitations';
    end if;
    select * into prefs from public.game_invitation_preferences where user_id=r.invitee_user_id;
    v_status := case when (r.room_kind='rpg' and not coalesce(prefs.rpg,true)) or
      (r.room_kind='chess' and not coalesce(prefs.chess,true)) then 'disabled' else 'pending' end;
    insert into public.game_invitations(topic,kind,host_id,invitee_id,status,expires_at)
    values(r.topic,r.room_kind,r.host_user_id,r.invitee_user_id,v_status,least(r.expires_at,v_now+interval '30 seconds')) returning * into i;
  end if;
  if i.topic is null or i.kind<>r.room_kind or i.host_id<>r.host_user_id or i.invitee_id<>r.invitee_user_id then raise exception 'Invitation is unavailable'; end if;
  if p_op='create' and p_user_id<>i.host_id then raise exception 'Only the host can send invitations'; end if;
  if i.status in ('pending','received') and (i.expires_at<=v_now or r.expires_at<=v_now) then
    update public.game_invitations set status='expired',updated_at=v_now where topic=p_topic returning * into i;
  end if;
  if p_op='cancel' then
    if p_user_id<>i.host_id then raise exception 'Only the host can cancel invitations'; end if;
    if i.status in ('pending','received') then
      update public.game_invitations set status='cancelled',updated_at=v_now where topic=p_topic returning * into i;
    end if;
  elsif p_op='reply' then
    if p_user_id<>i.invitee_id then raise exception 'Only the invited account can respond'; end if;
    if p_value is null or p_value not in ('received','accepted','declined','disabled','busy') then raise exception 'Invalid invitation reply'; end if;
    if i.status in ('pending','received') then
      select * into prefs from public.game_invitation_preferences where user_id=i.invitee_id;
      v_status := case when (i.kind='rpg' and not coalesce(prefs.rpg,true)) or
        (i.kind='chess' and not coalesce(prefs.chess,true)) then 'disabled' else p_value end;
      -- The status is written before joining, in the same transaction. A failed
      -- join raises and rolls back both changes, leaving no false acceptance.
      update public.game_invitations set status=v_status,updated_at=v_now where topic=p_topic returning * into i;
      if v_status='accepted' then
        v_join := public.join_realtime_room(p_user_id,p_topic);
        if v_join->>'success' is distinct from 'true' then raise exception 'Could not join invitation room'; end if;
      end if;
    end if;
  end if;
  select jsonb_build_object('topic',i.topic,'kind',i.kind,'host_id',i.host_id,'invitee_id',i.invitee_id,
    'host',h.username,'invitee',g.username,'status',i.status,'expires_at',i.expires_at) into v_json
    from public.players h,public.players g where h.user_id=i.host_id and g.user_id=i.invitee_id;
  return jsonb_build_object('success',true,'invitation',v_json,'server_now',v_now);
end;
$function$;
revoke all on function public.game_invitation_command(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.game_invitation_command(uuid,text,text,text) to service_role;

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

  if v_room.invitee_user_id = p_user_id and not exists (
    select 1 from public.game_invitations g where g.topic=p_topic
      and g.invitee_id=p_user_id and g.status='accepted'
  ) then
    return jsonb_build_object('success',false,'error','Invitation acceptance is required');
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

revoke all on function public.join_realtime_room(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.join_realtime_room(uuid,text) to service_role;

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
    and r.expires_at > clock_timestamp()
    and exists(select 1 from public.game_invitations g where g.topic=r.topic
      and g.kind=p_kind and g.invitee_id=p_user_id
      and (g.status='accepted' or (g.status in ('pending','received') and g.expires_at>clock_timestamp())))
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


-- Retire the shared invitation bus completely. A restrictive policy also
-- protects against older permissive policies left on the deployment.
create policy no_shared_invitation_bus on realtime.messages as restrictive
for all to authenticated using (realtime.topic()<>'chess-invitations')
with check (realtime.topic()<>'chess-invitations' and realtime.topic() !~ '^rpg-invitations:');
commit;
