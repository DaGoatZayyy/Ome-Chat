-- OmeChat safety foundation.
-- Apply to a dedicated Supabase project only after reviewing the safety model.
-- Queue/match creation is intentionally not exposed to anonymous browser clients.
create extension if not exists pgcrypto;

create table if not exists public.chat_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_verified boolean not null default false,
  age_verified_at timestamptz,
  verification_provider text,
  country_code text,
  interests text[] not null default '{}',
  banned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint country_code_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint verification_consistency check (
    (age_verified = false and age_verified_at is null and verification_provider is null)
    or (age_verified = true and age_verified_at is not null and verification_provider is not null)
  )
);

create table if not exists public.chat_queue (
  user_id uuid primary key references public.chat_profiles(user_id) on delete cascade,
  mode text not null check (mode in ('text', 'video')),
  country_code text,
  interests text[] not null default '{}',
  queued_at timestamptz not null default now(),
  constraint queue_country_code_format check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

create index if not exists chat_queue_queued_at_idx on public.chat_queue(queued_at);

create table if not exists public.chat_matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.chat_profiles(user_id) on delete cascade,
  user_b uuid not null references public.chat_profiles(user_id) on delete cascade,
  mode text not null check (mode in ('text', 'video')),
  status text not null default 'active' check (status in ('active', 'ended', 'reported', 'blocked')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint match_distinct_users check (user_a <> user_b)
);

create index if not exists chat_matches_user_a_active_idx on public.chat_matches(user_a, status);
create index if not exists chat_matches_user_b_active_idx on public.chat_matches(user_b, status);

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.chat_matches(id) on delete set null,
  reporter_id uuid not null references public.chat_profiles(user_id) on delete cascade,
  reported_user_id uuid not null references public.chat_profiles(user_id) on delete cascade,
  category text not null check (category in ('harassment', 'sexual_content', 'underage_concern', 'threats', 'spam', 'other')),
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint report_distinct_users check (reporter_id <> reported_user_id),
  constraint report_details_length check (details is null or char_length(details) <= 2000)
);

create table if not exists public.chat_blocks (
  blocker_id uuid not null references public.chat_profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.chat_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint block_distinct_users check (blocker_id <> blocked_id)
);

alter table public.chat_profiles enable row level security;
alter table public.chat_queue enable row level security;
alter table public.chat_matches enable row level security;
alter table public.chat_reports enable row level security;
alter table public.chat_blocks enable row level security;

-- No public table policies by design. Browser clients cannot read or mutate queues,
-- matches, verification status, reports, or blocks directly. Implement narrow,
-- authenticated server/Edge Function endpoints before allowing chat traffic.
revoke all on public.chat_profiles from anon, authenticated;
revoke all on public.chat_queue from anon, authenticated;
revoke all on public.chat_matches from anon, authenticated;
revoke all on public.chat_reports from anon, authenticated;
revoke all on public.chat_blocks from anon, authenticated;

grant all on public.chat_profiles to service_role;
grant all on public.chat_queue to service_role;
grant all on public.chat_matches to service_role;
grant all on public.chat_reports to service_role;
grant all on public.chat_blocks to service_role;

comment on table public.chat_profiles is 'Server-managed profile; age_verified must only be set by a trusted age-verification webhook after provider verification.';
comment on column public.chat_profiles.age_verified is 'False by default. Never set from a browser checkbox or user-editable metadata.';
comment on table public.chat_queue is 'Private matchmaking queue. Access only through a server-validated function.';
comment on table public.chat_reports is 'Moderation reports; access only through a protected server endpoint and staffed review process.';
