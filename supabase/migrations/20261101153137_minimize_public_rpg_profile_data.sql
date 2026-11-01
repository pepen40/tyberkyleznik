begin;

create or replace function public.sync_player_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  public_upgrades jsonb;
begin
  if tg_op = 'DELETE' then
    delete from public.player_public_profiles where player_id = old.id;
    return old;
  end if;

  public_upgrades := jsonb_build_object(
    'ashab', jsonb_build_object(
      'hp', case when coalesce(new.rpg_upgrades #>> '{ashab,hp}', '') ~ '^[0-9]{1,6}$'
        then (new.rpg_upgrades #>> '{ashab,hp}')::integer else 0 end,
      'atk', case when coalesce(new.rpg_upgrades #>> '{ashab,atk}', '') ~ '^[0-9]{1,6}$'
        then (new.rpg_upgrades #>> '{ashab,atk}')::integer else 0 end
    ),
    'apostol', jsonb_build_object(
      'hp', case when coalesce(new.rpg_upgrades #>> '{apostol,hp}', '') ~ '^[0-9]{1,6}$'
        then (new.rpg_upgrades #>> '{apostol,hp}')::integer else 0 end,
      'atk', case when coalesce(new.rpg_upgrades #>> '{apostol,atk}', '') ~ '^[0-9]{1,6}$'
        then (new.rpg_upgrades #>> '{apostol,atk}')::integer else 0 end
    ),
    'mee', jsonb_build_object(
      'hp', case when coalesce(new.rpg_upgrades #>> '{mee,hp}', '') ~ '^[0-9]{1,6}$'
        then (new.rpg_upgrades #>> '{mee,hp}')::integer else 0 end,
      'atk', case when coalesce(new.rpg_upgrades #>> '{mee,atk}', '') ~ '^[0-9]{1,6}$'
        then (new.rpg_upgrades #>> '{mee,atk}')::integer else 0 end
    ),
    'roachKills', case when coalesce(new.rpg_upgrades ->> 'roachKills', '') ~ '^[0-9]{1,9}$'
      then (new.rpg_upgrades ->> 'roachKills')::integer else 0 end
  );

  insert into public.player_public_profiles (
    player_id, username, max_score, item_points, pvp_pts,
    created_at, last_online, rpg_upgrades, rpg_max_floors, inventory
  ) values (
    new.id, new.username, coalesce(new.max_score, 0), coalesce(new.item_points, 0),
    coalesce(new.pvp_pts, 0), new.created_at, new.last_online,
    public_upgrades, coalesce(new.rpg_max_floors, '{}'::jsonb),
    coalesce(new.inventory, '[]'::jsonb)
  )
  on conflict (player_id) do update set
    username = excluded.username,
    max_score = excluded.max_score,
    item_points = excluded.item_points,
    pvp_pts = excluded.pvp_pts,
    created_at = excluded.created_at,
    last_online = excluded.last_online,
    rpg_upgrades = excluded.rpg_upgrades,
    rpg_max_floors = excluded.rpg_max_floors,
    inventory = excluded.inventory;

  return new;
end;
$function$;

revoke all on function public.sync_player_public_profile() from public, anon, authenticated;

update public.player_public_profiles pp
set rpg_upgrades = jsonb_build_object(
  'ashab', jsonb_build_object(
    'hp', case when coalesce(p.rpg_upgrades #>> '{ashab,hp}', '') ~ '^[0-9]{1,6}$'
      then (p.rpg_upgrades #>> '{ashab,hp}')::integer else 0 end,
    'atk', case when coalesce(p.rpg_upgrades #>> '{ashab,atk}', '') ~ '^[0-9]{1,6}$'
      then (p.rpg_upgrades #>> '{ashab,atk}')::integer else 0 end
  ),
  'apostol', jsonb_build_object(
    'hp', case when coalesce(p.rpg_upgrades #>> '{apostol,hp}', '') ~ '^[0-9]{1,6}$'
      then (p.rpg_upgrades #>> '{apostol,hp}')::integer else 0 end,
    'atk', case when coalesce(p.rpg_upgrades #>> '{apostol,atk}', '') ~ '^[0-9]{1,6}$'
      then (p.rpg_upgrades #>> '{apostol,atk}')::integer else 0 end
  ),
  'mee', jsonb_build_object(
    'hp', case when coalesce(p.rpg_upgrades #>> '{mee,hp}', '') ~ '^[0-9]{1,6}$'
      then (p.rpg_upgrades #>> '{mee,hp}')::integer else 0 end,
    'atk', case when coalesce(p.rpg_upgrades #>> '{mee,atk}', '') ~ '^[0-9]{1,6}$'
      then (p.rpg_upgrades #>> '{mee,atk}')::integer else 0 end
  ),
  'roachKills', case when coalesce(p.rpg_upgrades ->> 'roachKills', '') ~ '^[0-9]{1,9}$'
    then (p.rpg_upgrades ->> 'roachKills')::integer else 0 end
)
from public.players p
where pp.player_id = p.id;

commit;
