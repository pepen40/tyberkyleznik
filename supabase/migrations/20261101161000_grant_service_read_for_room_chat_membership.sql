-- The Edge Function uses the service-role client to verify room membership
-- before publishing chat messages. Browser roles remain fully revoked.
begin;
grant select on table public.realtime_room_access to service_role;
commit;
