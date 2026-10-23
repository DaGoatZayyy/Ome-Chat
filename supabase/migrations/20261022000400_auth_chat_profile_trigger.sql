-- Ensure every Supabase Auth user has a server-managed chat profile.
-- This creates profiles only; it does NOT mark users age-verified or eligible.
create or replace function public.handle_new_auth_user_chat_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.chat_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Backfill accounts that were created before this trigger existed.
insert into public.chat_profiles (user_id)
select u.id
from auth.users as u
on conflict (user_id) do nothing;

drop trigger if exists on_auth_user_created_chat_profile on auth.users;

create trigger on_auth_user_created_chat_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user_chat_profile();

-- The trigger function is only intended to be called by the Auth trigger.
revoke all on function public.handle_new_auth_user_chat_profile() from public, anon, authenticated;
