begin;

-- Preserve the inaccessible, pre-Auth legacy profile while preventing
-- usernames that differ only by letter case from being registered separately.
update public.players
set username = 'Apostol_legacy72'
where id = 72
  and user_id is null
  and username = 'Apostol';

create unique index if not exists players_username_lower_uidx
  on public.players (lower(username));

create unique index if not exists player_public_profiles_username_lower_uidx
  on public.player_public_profiles (lower(username));

commit;
