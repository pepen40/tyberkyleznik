begin;
select plan(22);
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-4000-8000-000000000601','authenticated','authenticated','invite-a@example.invalid','',now(),'{}','{}',now(),now()),
('00000000-0000-4000-8000-000000000602','authenticated','authenticated','invite-b@example.invalid','',now(),'{}','{}',now(),now()),
('00000000-0000-4000-8000-000000000603','authenticated','authenticated','invite-c@example.invalid','',now(),'{}','{}',now(),now());
insert into public.players(user_id,username) values
('00000000-0000-4000-8000-000000000601','invite-a'),('00000000-0000-4000-8000-000000000602','invite-b'),('00000000-0000-4000-8000-000000000603','invite-c');
select public.register_realtime_room('00000000-0000-4000-8000-000000000601','chess-room-10000000-0000-4000-8000-000000000601','chess','invite-b',false);
select ok(not has_function_privilege('authenticated','public.game_invitation_command(uuid,text,text,text)','execute'),'browser cannot impersonate RPC actor');
select ok(not has_table_privilege('authenticated','public.game_invitations','select'),'no direct access to private invitations');
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000601','create','chess-room-10000000-0000-4000-8000-000000000601')->'invitation'->>'kind','chess','type is derived from registered room');
select throws_ok($$select public.game_invitation_command('00000000-0000-4000-8000-000000000602','create','chess-room-10000000-0000-4000-8000-000000000601')$$,'P0001','Only the host can send invitations','invitee cannot impersonate sender');
select throws_ok($$select public.game_invitation_command('00000000-0000-4000-8000-000000000603','read','chess-room-10000000-0000-4000-8000-000000000601')$$,'P0001','Invitation is unavailable','outsider cannot read another invitation');
select is(public.join_realtime_room('00000000-0000-4000-8000-000000000602','chess-room-10000000-0000-4000-8000-000000000601')->>'success','false','guest cannot bypass acceptance');
select throws_ok($$select public.game_invitation_command('00000000-0000-4000-8000-000000000601','reply','chess-room-10000000-0000-4000-8000-000000000601','accepted')$$,'P0001','Only the invited account can respond','host cannot forge acceptance');
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000602','reply','chess-room-10000000-0000-4000-8000-000000000601','received')->'invitation'->>'status','received','receipt is not acceptance');
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000602','reply','chess-room-10000000-0000-4000-8000-000000000601','accepted')->'invitation'->>'status','accepted','intended guest accepts');
select is(public.join_realtime_room('00000000-0000-4000-8000-000000000602','chess-room-10000000-0000-4000-8000-000000000601')->>'success','true','acceptance atomically admitted intended guest');
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000602','reply','chess-room-10000000-0000-4000-8000-000000000601','declined')->'invitation'->>'status','accepted','terminal acceptance cannot be rewritten');
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000601','cancel','chess-room-10000000-0000-4000-8000-000000000601')->'invitation'->>'status','accepted','late cancellation does not tear down accepted room');
select is(jsonb_array_length(public.game_invitation_command('00000000-0000-4000-8000-000000000603','list')->'invitations'),0,'outsider list leaks no participants/topics');
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000602','settings','','{"rpg":false,"chess":false}')->>'rpg','false','blocking preference is server-owned');
select public.register_realtime_room('00000000-0000-4000-8000-000000000601','room_secure001','rpg','invite-b',false);
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000601','create','room_secure001')->'invitation'->>'status','disabled','RPG respects server block');
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000602','reply','room_secure001','accepted')->'invitation'->>'status','disabled','blocked invitation cannot be revived');
select public.register_realtime_room('00000000-0000-4000-8000-000000000601','room_cancel001','rpg','invite-c',false);
select public.game_invitation_command('00000000-0000-4000-8000-000000000601','create','room_cancel001');
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000601','cancel','room_cancel001')->'invitation'->>'status','cancelled','host cancellation persists');
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000603','reply','room_cancel001','accepted')->'invitation'->>'status','cancelled','cancelled invitation cannot be accepted');
select public.register_realtime_room('00000000-0000-4000-8000-000000000601','room_expire001','rpg','invite-c',false);
select public.game_invitation_command('00000000-0000-4000-8000-000000000601','create','room_expire001');
update public.game_invitations set expires_at=clock_timestamp()-interval '1 second' where topic='room_expire001';
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000603','reply','room_expire001','accepted')->'invitation'->>'status','expired','expired invitation cannot be accepted');
select ok((select qual like '%chess-invitations%' and with_check like '%rpg-invitations%' from pg_policies where schemaname='realtime' and policyname='no_shared_invitation_bus'),'RLS retires shared bus and forbids client RPG inbox writes');
select ok((select qual like '%online-users%' and with_check like '%challenge_response%' from pg_policies where schemaname='realtime' and policyname='no_shared_invitation_bus'),'legacy public RPG invitation broadcasts are denied too');
select public.register_realtime_room('00000000-0000-4000-8000-000000000601','room_block0001','rpg','invite-c',false);
select public.game_invitation_command('00000000-0000-4000-8000-000000000601','create','room_block0001');
select public.game_invitation_command('00000000-0000-4000-8000-000000000603','settings','','{"rpg":false,"chess":false}');
select is(public.game_invitation_command('00000000-0000-4000-8000-000000000601','read','room_block0001')->'invitation'->>'status','disabled','blocking finalizes already pending invitations for the sender');
select * from finish();
rollback;
