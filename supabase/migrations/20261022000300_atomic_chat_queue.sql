-- Atomic queue matching. The API verifies the bearer token and trusted age_verified
-- profile before calling this function. Only the server secret role can execute it.
create or replace function public.omechat_enqueue_and_match(
  p_user_id uuid,
  p_mode text,
  p_country_code text default null,
  p_interests text[] default '{}'
)
returns table(status text, match_id uuid, peer_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate uuid;
  new_match uuid;
begin
  if p_mode not in ('text', 'video') then
    raise exception 'invalid mode';
  end if;

  -- Serialize matchmaking attempts to avoid pairing one queue entry twice.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_mode, 0));

  if not exists (
    select 1 from public.chat_profiles p
    where p.user_id = p_user_id and p.age_verified = true and p.banned_at is null
  ) then
    raise exception 'account not eligible';
  end if;

  delete from public.chat_queue q where q.user_id = p_user_id;
  insert into public.chat_queue(user_id, mode, country_code, interests, queued_at)
  values (p_user_id, p_mode, p_country_code, coalesce(p_interests, '{}'), now());

  select q.user_id into candidate
  from public.chat_queue q
  join public.chat_profiles p on p.user_id = q.user_id
  where q.user_id <> p_user_id
    and q.mode = p_mode
    and p.age_verified = true
    and p.banned_at is null
    and not exists (
      select 1 from public.chat_blocks b
      where (b.blocker_id = p_user_id and b.blocked_id = q.user_id)
         or (b.blocker_id = q.user_id and b.blocked_id = p_user_id)
    )
    and not exists (
      select 1 from public.chat_matches m
      where m.status = 'active'
        and (m.user_a in (p_user_id, q.user_id) or m.user_b in (p_user_id, q.user_id))
    )
  order by q.queued_at
  for update of q skip locked
  limit 1;

  if candidate is null then
    return query select 'queued'::text, null::uuid, null::uuid;
    return;
  end if;

  delete from public.chat_queue where user_id in (p_user_id, candidate);
  insert into public.chat_matches(user_a, user_b, mode, status)
  values (p_user_id, candidate, p_mode, 'active')
  returning id into new_match;

  return query select 'matched'::text, new_match, candidate;
end;
$$;

revoke all on function public.omechat_enqueue_and_match(uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function public.omechat_enqueue_and_match(uuid, text, text, text[]) to service_role;
