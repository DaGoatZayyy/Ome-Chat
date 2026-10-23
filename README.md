# OmeChat

OmeChat is a Next.js app wired to Supabase Auth, server-authorized matchmaking, persistent chat messages, private Supabase Realtime, WebRTC signaling, conversation ending, and reports.

## Environment

Copy `.env.example` to `.env.local` and configure:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the browser client.
- `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) server-side only.
- `STUN_URLS`, `TURN_URLS`, and `TURN_REST_SECRET` for STUN and coturn-compatible TURN REST credentials.

Never expose a Supabase secret key in a `NEXT_PUBLIC_*` variable. TURN credentials are short-lived and minted by `/api/ice-config`; the TURN server must use the same shared secret. Enable email/password authentication in Supabase Auth and set the production Site URL and redirect URLs.

## Database setup

Apply these migrations in order:

1. `supabase/migrations/20261022000100_chat_safety_foundation.sql`
2. `supabase/migrations/20261022000200_chat_realtime_and_messages.sql`
3. `supabase/migrations/20261022000300_atomic_chat_queue.sql`
4. `supabase/migrations/20261022000400_auth_chat_profile_trigger.sql`
5. `supabase/migrations/20261022000500_chat_age_review_audit.sql`

Private Realtime channels and the included RLS policies must be enabled and tested. The fourth migration backfills missing `chat_profiles` rows for existing Auth users and creates a profile for new signups. New profiles remain `age_verified = false`; the server APIs require that field to be populated by a trusted provider's server-side integration. This page does not add a self-declared age check. Coordinate that profile update with the provider before enabling real matching.

## Admin panel

The `/admin` panel lists up to 200 Auth accounts and their chat profile / age-review status. Access is restricted server-side to exact email addresses in the server-only `ADMIN_EMAILS` environment variable (comma-separated). Set it in local `.env.local` and Vercel Project Settings → Environment Variables, then redeploy. Do not put this variable under a `NEXT_PUBLIC_*` name. The admin age-review audit migration must be applied before using the review controls. Admin review actions require a note and are logged; approve an account only after appropriate age evidence has been reviewed under your verification policy.

## Connected frontend

- Supabase Auth: sign up, sign in, persisted sessions, sign out.
- Matchmaking: enqueue by text/video mode, country and interests; poll for a server-created match; cancel/skip/end.
- Text chat: load history, persist messages through the API, subscribe to private Realtime message broadcasts.
- Video chat: request camera/microphone, negotiate WebRTC through the private match topic, and fetch ICE configuration.
- Moderation: submit a report with a category/details and end the conversation.

## Run and test

```bash
npm install
npm run lint
npm run build
npm run dev
```

Set all required environment variables in Vercel Project Settings → Environment Variables and redeploy. Check `/api/health`, Supabase logs, and Vercel build/runtime logs. A successful Next.js build does not prove that two real accounts can match: verify with two test accounts after migrations, Realtime policies, provider eligibility, and STUN/TURN are configured. Do not put production secrets in test logs or source control.

## Remaining external setup

This repository's code cannot create your Supabase project settings, apply database migrations to your project, supply provider credentials/webhooks, or configure a TURN service on your behalf. Public matching will not work until those external services are configured and verified.