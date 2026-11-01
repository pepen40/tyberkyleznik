begin;

alter table public.players
  add constraint players_user_id_auth_users_fkey
  foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.players
  validate constraint players_user_id_auth_users_fkey;

alter table public.player_public_profiles
  add constraint player_public_profiles_player_id_players_fkey
  foreign key (player_id) references public.players(id) on delete cascade not valid;
alter table public.player_public_profiles
  validate constraint player_public_profiles_player_id_players_fkey;

alter table public.action_cooldowns
  add constraint action_cooldowns_user_id_auth_users_fkey
  foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.action_cooldowns
  validate constraint action_cooldowns_user_id_auth_users_fkey;

alter table public.reward_guardrails
  add constraint reward_guardrails_user_id_auth_users_fkey
  foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.reward_guardrails
  validate constraint reward_guardrails_user_id_auth_users_fkey;

commit;
