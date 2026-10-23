-- Admin-reviewed age decisions are auditable and server-only.
create table if not exists public.chat_age_review_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('approved', 'revoked')),
  note text not null check (char_length(trim(note)) between 10 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists chat_age_review_audit_target_created_idx
  on public.chat_age_review_audit(target_user_id, created_at desc);

alter table public.chat_age_review_audit enable row level security;
revoke all on public.chat_age_review_audit from anon, authenticated;
grant all on public.chat_age_review_audit to service_role;

comment on table public.chat_age_review_audit is
  'Server-only audit trail for authorized administrator age-review decisions. Record only decisions made after appropriate review.';
