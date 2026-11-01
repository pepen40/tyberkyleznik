begin;

drop policy if exists authenticated_realtime_send_app_channels on realtime.messages;

create policy authenticated_realtime_send_app_channels
on realtime.messages
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (
    (
      realtime.topic() = 'online-users'
      and (
        extension = 'presence'
        or (
          extension = 'broadcast'
          and coalesce(payload ->> 'event', '') in ('challenge', 'challenge_response')
        )
      )
    )
    or (
      realtime.topic() = 'pvp_lobby'
      and extension = 'presence'
    )
    or (
      realtime.topic() = 'chess-invitations'
      and extension = 'broadcast'
      and coalesce(payload ->> 'event', '') in ('chess_invite', 'chess_invite_answer')
    )
    or (
      (
        realtime.topic() ~ '^room_[a-z0-9]{9}$'
        or realtime.topic() ~ '^chess-room-[0-9a-f-]{36}$'
      )
      and extension = 'broadcast'
      and coalesce(payload ->> 'event', '') <> 'chat_message'
      and private.can_access_realtime_topic(realtime.topic())
    )
  )
);

commit;
