begin;

select plan(9);

select has_function('public', 'get_rpg_invitation_peer', array['uuid', 'text', 'text'], 'server peer lookup exists');
select has_function('public', 'close_rpg_invitation', array['uuid', 'text', 'text'], 'server invitation close exists');

select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.get_rpg_invitation_peer(uuid,text,text)'::regprocedure),
  'peer lookup is SECURITY DEFINER with an empty search_path'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.close_rpg_invitation(uuid,text,text)'::regprocedure),
  'invitation close is SECURITY DEFINER with an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.get_rpg_invitation_peer(uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.get_rpg_invitation_peer(uuid,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.get_rpg_invitation_peer(uuid,text,text)', 'EXECUTE'),
  'only service_role can execute peer lookup'
);
select ok(
  not has_function_privilege('anon', 'public.close_rpg_invitation(uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.close_rpg_invitation(uuid,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.close_rpg_invitation(uuid,text,text)', 'EXECUTE'),
  'only service_role can execute invitation close'
);

select has_policy('realtime', 'messages', 'authenticated_receive_own_rpg_invitation_inbox', 'private inbox receive policy exists');
select ok(
  (select polcmd = 'r'
      and polroles = array[(select oid from pg_roles where rolname = 'authenticated')]::oid[]
      and pg_get_expr(polqual, polrelid) like '%auth.uid%'
      and pg_get_expr(polqual, polrelid) like '%rpg-invitations:%'
   from pg_policy
   where polrelid = 'realtime.messages'::regclass
     and polname = 'authenticated_receive_own_rpg_invitation_inbox'),
  'inbox read is limited to authenticated users whose uid matches the topic'
);
select ok(
  not exists (
    select 1 from pg_policy
    where polrelid = 'realtime.messages'::regclass
      and polcmd in ('a', 'w', '*')
      and coalesce(pg_get_expr(polwithcheck, polrelid), '') like '%rpg-invitations:%'
  ),
  'clients have no RLS policy to send directly to invitation inboxes'
);

select * from finish();
rollback;
