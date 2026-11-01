-- Supabase Auth + least-privilege access for player profiles.
-- Apply only after the frontend Auth migration is deployed.

begin;

alter table public.players enable row level security;

drop policy if exists players_authenticated_read on public.players;
drop policy if exists players_select_own on public.players;
create policy players_select_own
  on public.players
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists players_update_own_last_online on public.players;
create policy players_update_own_last_online
  on public.players
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.players from anon, authenticated;
grant select (
  id, user_id, username, max_score, coins, inventory, item_points,
  rpg_upgrades, rpg_max_floors, created_at, last_online, pvp_pts
) on table public.players to authenticated;
grant update (last_online) on table public.players to authenticated;

create or replace view public.player_public_profiles
with (security_invoker = false)
as
select
  username, max_score, item_points, pvp_pts,
  created_at, last_online, rpg_upgrades, rpg_max_floors, inventory
from public.players;

revoke all on public.player_public_profiles from public;
grant select on public.player_public_profiles to anon, authenticated;

-- The signup trigger is invoked by Postgres on auth.users INSERT, never by the Data API.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

commit;

-- Server-side throttling for high-value game reward actions.
create table if not exists public.action_cooldowns (
  user_id uuid not null,
  action text not null,
  last_used_at timestamptz not null default now(),
  primary key (user_id, action)
);
alter table public.action_cooldowns enable row level security;
revoke all on public.action_cooldowns from public, anon, authenticated;
grant all on public.action_cooldowns to service_role;

create or replace function public.check_action_cooldown(
  p_user_id uuid,
  p_action text,
  p_cooldown_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  allowed boolean;
begin
  if p_user_id is null or p_action is null or p_cooldown_seconds < 0 or p_cooldown_seconds > 86400 then
    return false;
  end if;

  insert into public.action_cooldowns (user_id, action, last_used_at)
  values (p_user_id, p_action, now())
  on conflict (user_id, action) do update
    set last_used_at = now()
    where public.action_cooldowns.last_used_at <= now() - make_interval(secs => p_cooldown_seconds)
  returning true into allowed;

  return coalesce(allowed, false);
end;
$function$;

revoke all on function public.check_action_cooldown(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.check_action_cooldown(uuid, text, integer) to service_role;
