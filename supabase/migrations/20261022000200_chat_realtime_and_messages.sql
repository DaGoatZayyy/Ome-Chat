-- Private per-match messaging and Realtime signaling authorization.
-- Requires the safety-foundation migration and authenticated Supabase Auth users.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.chat_matches(id) on delete cascade,
  sender_id uuid not null references public.chat_profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_match_created_idx
  on public.chat_messages(match_id, created_at);

alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;
grant all on public.chat_messages to service_role;

-- Realtime topics must be private. Only active match participants may receive
-- signaling broadcasts. Do not add broad "authenticated can read all" policies.
drop policy if exists "OmeChat match participants can receive broadcasts" on realtime.messages;
create policy "OmeChat match participants can receive broadcasts"
on realtime.messages for select to authenticated
using (
  extension = 'broadcast'
  and exists (
    select 1
    from public.chat_matches m
    where m.id::text = split_part(realtime.topic(), ':', 2)
      and realtime.topic() like 'match:%'
      and m.status = 'active'
      and (m.user_a = (select auth.uid()) or m.user_b = (select auth.uid()))
  )
);

drop policy if exists "OmeChat match participants can send broadcasts" on realtime.messages;
create policy "OmeChat match participants can send broadcasts"
on realtime.messages for insert to authenticated
with check (
  extension = 'broadcast'
  and exists (
    select 1
    from public.chat_matches m
    where m.id::text = split_part(realtime.topic(), ':', 2)
      and realtime.topic() like 'match:%'
      and m.status = 'active'
      and (m.user_a = (select auth.uid()) or m.user_b = (select auth.uid()))
  )
);

comment on table public.chat_messages is 'Text chat history. Access through authenticated server endpoints; never grant direct browser access.';

-- Broadcast committed text messages to the same private match topic.
create or replace function public.omechat_broadcast_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'id', new.id,
      'match_id', new.match_id,
      'sender_id', new.sender_id,
      'body', new.body,
      'created_at', new.created_at
    ),
    'message',
    'match:' || new.match_id::text,
    true
  );
  return new;
end;
$$;

revoke all on function public.omechat_broadcast_chat_message() from public, anon, authenticated;

drop trigger if exists omechat_chat_message_broadcast on public.chat_messages;
create trigger omechat_chat_message_broadcast
after insert on public.chat_messages
for each row execute function public.omechat_broadcast_chat_message();
