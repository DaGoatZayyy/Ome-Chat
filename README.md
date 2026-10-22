# OmeChat

A lightweight Next.js interface for a moderated chat experience. The current UI is a preview: it can request local camera/microphone permissions and display messages locally, but it does not connect users or send messages to a server.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set the Supabase project URL, publishable key, and server-only secret key. Legacy anon/service-role keys are supported by the health endpoint as alternatives.
5. Run `npm run dev` and open http://localhost:3000.
6. Visit `/api/health` to check whether the environment variables are present.

Never commit real credentials. Never expose a Supabase secret/service-role key in browser code or a `NEXT_PUBLIC_*` variable.

## Deploy to Vercel

Import this repository in Vercel, add the variables from `.env.example` in Project Settings → Environment Variables, then deploy. Redeploy after changing environment variables.

## Supabase schema

The repository migration at `supabase/migrations/20261022000100_chat_safety_foundation.sql` is a separate, public-schema safety foundation for profiles, queue entries, matches, reports, and blocks. The 15-minute cleanup SQL supplied separately creates tables in the `private` schema (`chat_sessions`, `chat_messages`, `chat_queue`, `chat_reports`, `chat_blocks`) and is not automatically connected to the current UI.

Before applying additional SQL, check which schema/tables exist in Supabase to avoid maintaining two competing data models. Verify the `pg_cron` job appears and runs successfully; don't assume cleanup is working without testing it. Reports should have an explicit retention policy that allows moderation review.

## Lightweight design

- Uses system fonts rather than fetching external web fonts.
- Does not store camera or microphone recordings.
- Uses a small client-side interface without a heavy component library.
- Stops local media tracks when leaving the chat screen.

## Not ready for public launch

Actual authentication, server-backed messaging, moderation operations, abuse prevention, and secure connection signaling are not implemented. The readiness endpoint intentionally reports those checks as false. Do not advertise the preview as live chat until these systems are implemented, reviewed, and tested for an age-appropriate, moderated community.

Before launch, test keyboard navigation, mobile layout, camera permission denial, missing devices, connection loss, report/block workflows, rate limits, and cleanup jobs. Review Vercel and Supabase usage/retention limits for your project tier.
