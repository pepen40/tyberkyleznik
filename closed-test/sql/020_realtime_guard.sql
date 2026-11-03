-- Applied AFTER the unchanged component migrations, only in isolated-v1.
begin;
do $$ begin
  if not exists(select 1 from private.closed_test_environment where profile='isolated-v1') then
    raise exception 'Closed-test marker missing';
  end if;
end $$;
create policy closed_test_participant_only on realtime.messages as restrictive
  for all to authenticated using((select private.closed_test_member()))
  with check((select private.closed_test_member()));
commit;
