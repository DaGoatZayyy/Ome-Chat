# OmeChat

A Next.js recreation of the supplied OmeChat interface. The responsive landing page and chat UI are in place; the production stranger-matching service is deliberately disabled until age assurance, moderation, and server-side matchmaking are configured.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Add the Supabase URL and publishable/anon key. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; never expose it in browser code.
5. Run `npm run dev` and open http://localhost:3000.
6. Visit `/api/health` to inspect the current backend readiness flags.

## Deploy to Vercel

Import this repository in Vercel. Configure the environment variables from `.env.example` in the Vercel project settings, then deploy. The Supabase service-role key must be added only as a server environment variable, never as a `NEXT_PUBLIC_*` variable.

## Database safety foundation

A reviewed starting schema is in `supabase/migrations/20261022000100_chat_safety_foundation.sql`. Apply it only to a dedicated Supabase project after reviewing it. It creates private tables for profiles, queue entries, matches, reports, and blocks, enables RLS, and revokes direct access from browser roles. The schema intentionally does not expose queue or match mutations to anonymous clients.

The `age_verified` field defaults to false and must only be set by a trusted age-verification provider webhook after a successful verification. A browser checkbox or editable user metadata is not age verification.

## Required before public launch

- Integrate a reliable age-assurance provider suitable for an 18+ service, including a trusted server-to-server callback.
- Implement authenticated, rate-limited server-side matchmaking that checks verified age and bans, excludes blocked users, and atomically creates matches.
- Implement short-lived, authorized WebRTC signaling and configure TURN as well as STUN.
- Add a staffed report-review and escalation workflow, privacy policy, terms, abuse prevention, and retention/deletion rules.
- Verify camera/microphone permission-denied, missing-device, reconnect, skip, report, block, and disconnect paths.
- Conduct security review and test with multiple browsers before opening public access.

## Current status

Implemented: responsive landing page, chat UI, local camera/microphone permission flow, local text-composer preview, safety/age notice, server readiness endpoint, and private database schema foundation.

Not implemented or enabled: verified age assurance, actual stranger matching, server signaling, remote video transport, server-backed messages, production reports/blocks, and moderation operations. The current UI does not connect strangers. Do not advertise it as a working live-chat service until those components are built, configured, and tested.
