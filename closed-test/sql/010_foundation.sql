-- NEW isolated closed-test schema v1. NOT recovered production history.
-- Apply only in a fresh local Supabase project created by closed-test/manage.cjs.
begin;
do $$ begin
  if current_database() <> 'postgres' or to_regclass('public.players') is not null then
    raise exception 'Closed-test foundation requires a fresh disposable application schema';
  end if;
end $$;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table private.closed_test_environment (
  profile text primary key check(profile='isolated-v1'),
  expires_at timestamptz not null
);
insert into private.closed_test_environment values('isolated-v1',clock_timestamp()+interval '24 hours');
create table private.closed_test_participants (
  user_id uuid primary key references auth.users(id),
  enabled boolean not null default true
);
alter table private.closed_test_environment enable row level security;
alter table private.closed_test_participants enable row level security;
revoke all on private.closed_test_environment, private.closed_test_participants from public, anon, authenticated, service_role;

create function public.authorize_closed_test_user(p_user_id uuid) returns boolean
language sql security definer set search_path='' as $$
  select exists(select 1 from private.closed_test_participants p,private.closed_test_environment e
    where p.user_id=p_user_id and p.enabled and e.profile='isolated-v1' and e.expires_at>clock_timestamp())
$$;
revoke all on function public.authorize_closed_test_user(uuid) from public,anon,authenticated;
grant execute on function public.authorize_closed_test_user(uuid) to service_role;
create function private.closed_test_member() returns boolean
language sql security definer set search_path='' as $$
  select public.authorize_closed_test_user(auth.uid())
$$;
revoke all on function private.closed_test_member() from public,anon;
grant execute on function private.closed_test_member() to authenticated;

create table public.players (
  id bigint generated always as identity primary key,
  user_id uuid unique not null references auth.users(id),
  username text not null check(username ~ '^[a-zA-Zа-яА-Я0-9_]{3,20}$'),
  max_score integer not null default 0 check(max_score=0),
  coins integer not null default 0 check(coins=0),
  pvp_pts integer not null default 0 check(pvp_pts=0),
  inventory jsonb not null default '[]',
  item_points integer not null default 0,
  rpg_upgrades jsonb not null default '{}',
  rpg_max_floors jsonb not null default '{}'
);
create unique index closed_test_username_lower on public.players(lower(username));
alter table public.players enable row level security;
revoke all on public.players from public,anon,authenticated;
grant select on public.players to authenticated;
grant all on public.players to service_role;
grant usage,select on sequence public.players_id_seq to service_role;
create policy closed_test_own_player on public.players for select to authenticated
  using(user_id=(select auth.uid()) and (select private.closed_test_member()));
create table public.player_public_profiles (
  player_id bigint primary key references public.players(id),
  username text not null,
  max_score integer not null default 0,
  item_points integer not null default 0,
  pvp_pts integer not null default 0,
  rpg_upgrades jsonb not null default '{}'
);
alter table public.player_public_profiles enable row level security;
revoke all on public.player_public_profiles from public,anon,authenticated;
grant select on public.player_public_profiles to authenticated;
grant all on public.player_public_profiles to service_role;
create policy closed_test_profile_read on public.player_public_profiles for select to authenticated
  using((select private.closed_test_member()));
create function private.closed_test_sync_profile() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  insert into public.player_public_profiles(player_id,username,max_score,item_points,pvp_pts,rpg_upgrades)
  values(new.id,new.username,0,new.item_points,0,jsonb_build_object('ashab',new.rpg_upgrades->'ashab','apostol',new.rpg_upgrades->'apostol','mee',new.rpg_upgrades->'mee'))
  on conflict(player_id) do update set username=excluded.username,item_points=excluded.item_points,rpg_upgrades=excluded.rpg_upgrades;
  return new;
end $$;
revoke all on function private.closed_test_sync_profile() from public,anon,authenticated;
create trigger closed_test_profile_sync after insert or update on public.players
  for each row execute function private.closed_test_sync_profile();

create table public.action_cooldowns(user_id uuid not null,action text not null,last_used_at timestamptz not null,primary key(user_id,action));
alter table public.action_cooldowns enable row level security;
revoke all on public.action_cooldowns from public,anon,authenticated;
grant all on public.action_cooldowns to service_role;
create function public.check_action_cooldown(p_user_id uuid,p_action text,p_cooldown_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$ declare allowed boolean; begin
  if not public.authorize_closed_test_user(p_user_id) or p_action is null or p_cooldown_seconds not between 0 and 86400 then return false; end if;
  insert into public.action_cooldowns values(p_user_id,p_action,clock_timestamp())
  on conflict(user_id,action) do update set last_used_at=clock_timestamp()
    where public.action_cooldowns.last_used_at<=clock_timestamp()-make_interval(secs=>p_cooldown_seconds)
  returning true into allowed;
  return coalesce(allowed,false);
end $$;
revoke all on function public.check_action_cooldown(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.check_action_cooldown(uuid,text,integer) to service_role;

create function public.provision_closed_test_player(p_user_id uuid,p_username text) returns void
language plpgsql security definer set search_path='' as $$ begin
  if not exists(select 1 from private.closed_test_environment where profile='isolated-v1' and expires_at>clock_timestamp())
    or not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Closed-test environment/user unavailable'; end if;
  insert into private.closed_test_participants(user_id) values(p_user_id);
  insert into public.players(user_id,username,inventory,rpg_upgrades)
  values(p_user_id,p_username,jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','картофель','rarity','Обычное','img','img_kartofel.png')),
    '{"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}}');
end $$;
revoke all on function public.provision_closed_test_player(uuid,text) from public,anon,authenticated;
grant execute on function public.provision_closed_test_player(uuid,text) to service_role;
create extension if not exists pgtap with schema extensions;
commit;
