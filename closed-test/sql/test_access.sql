begin;
select plan(12);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-4000-8000-000000008001','authenticated','authenticated','closed-a@example.invalid','','{}','{}',now(),now()),
('00000000-0000-4000-8000-000000008002','authenticated','authenticated','closed-b@example.invalid','','{}','{}',now(),now()),
('00000000-0000-4000-8000-000000008003','authenticated','authenticated','closed-out@example.invalid','','{}','{}',now(),now());
select public.provision_closed_test_player('00000000-0000-4000-8000-000000008001','closed_a');
select public.provision_closed_test_player('00000000-0000-4000-8000-000000008002','closed_b');
select ok(public.authorize_closed_test_user('00000000-0000-4000-8000-000000008001'),'issued tester is authorized');
select ok(not public.authorize_closed_test_user('00000000-0000-4000-8000-000000008003'),'Auth account alone gives no test access');
select ok(not has_function_privilege('authenticated','public.provision_closed_test_player(uuid,text)','EXECUTE'),'browser cannot issue accounts');
select ok(not has_function_privilege('authenticated','public.authorize_closed_test_user(uuid)','EXECUTE'),'browser cannot probe arbitrary tester IDs through the service RPC');
select ok(not has_table_privilege('anon','public.players','SELECT'),'anon cannot read players');
select ok(not has_table_privilege('authenticated','private.closed_test_participants','UPDATE'),'browser cannot approve itself');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008001',true);
select is((select count(*) from public.players),1::bigint,'RLS exposes only own private player');
select is((select count(*) from public.players where user_id='00000000-0000-4000-8000-000000008002'),0::bigint,'other private inventory is hidden');
select throws_ok($$update public.players set coins=1000000$$,'42501',null,'client cannot mint currency');
reset role;
select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='player_public_profiles' and column_name in ('user_id','inventory','coins')),'public projection omits private fields');
update private.closed_test_environment set expires_at=clock_timestamp()-interval '1 second';
select ok(not public.authorize_closed_test_user('00000000-0000-4000-8000-000000008001'),'expired test closes authorization');
select ok(exists(select 1 from pg_policy where polrelid='realtime.messages'::regclass and polname='closed_test_participant_only' and not polpermissive),'Realtime has a restrictive participant policy');
select * from finish();
rollback;
