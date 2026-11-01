begin;
create index if not exists realtime_room_access_host_user_id_idx on public.realtime_room_access(host_user_id);
create index if not exists realtime_room_access_guest_user_id_idx on public.realtime_room_access(guest_user_id);
create index if not exists realtime_room_access_invitee_user_id_idx on public.realtime_room_access(invitee_user_id);
create index if not exists realtime_room_access_expires_at_idx on public.realtime_room_access(expires_at);
commit;
