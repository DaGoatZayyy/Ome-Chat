# OmeChat

OmeChat is a Next.js chat interface with server-side chat API foundations and optional Supabase Realtime/WebRTC helpers.

## Environment

Copy `.env.example` to `.env.local` and configure:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the browser client.
- `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) server-side only.
- `STUN_URLS`, `TURN_URLS`, and `TURN_REST_SECRET` for STUN and coturn-compatible TURN REST credentials.

Never commit secrets or expose a Supabase secret key in a `NEXT_PUBLIC_*` variable. TURN REST credentials are short-lived and minted by `/api/ice-config`; the TURN server must use the same shared secret.

## Database setup

Apply migrations in order in your Supabase project:

1. `supabase/migrations/20261022000100_chat_safety_foundation.sql`
2. `supabase/migrations/20261022000200_chat_realtime_and_messages.sql`
3. `supabase/migrations/20261022000300_atomic_chat_queue.sql`

The `public.chat_profiles.age_verified` flag must be set only by a trusted age-verification provider's server-side webhook. A checkbox or editable user metadata is not verification. Ensure Supabase Realtime private channels are enabled and public channel access is disabled.

## API and modules added

- `POST /api/chat/queue`: queue an eligible account for text/video matching using an atomic database function.
- `DELETE /api/chat/queue`: remove the caller from the queue.
- `GET /api/chat/session`: check whether the caller has an active match.
- `DELETE /api/chat/session?matchId=...`: end the caller's active match.
- `POST /api/chat/report`: submit a moderation report and block repeat matching with the reported account.
- `GET /api/chat/messages?matchId=...`: fetch messages for the caller's active match.
- `POST /api/chat/messages`: persist a message after checking eligibility and active match membership.
- `GET /api/ice-config`: return STUN and short-lived TURN credentials for an eligible account.
- `lib/chat/messages.ts`: helpers for history, sending, and private Realtime message subscriptions.
- `lib/chat/webrtc.ts`: WebRTC offer/answer/ICE exchange over a private `match:<uuid>` channel.
- `lib/supabase/browser.ts` and `lib/server/supabase-admin.ts`: browser/server Supabase clients.

## Integration status

These APIs/helpers are infrastructure, not a completed live-chat launch. The current `app/page.tsx` preview still needs to be connected to Supabase Auth sessions, queue API, message helpers, Realtime channels, and the WebRTC peer helper. Do not enable public matching until trusted age verification is wired, Realtime policies are applied and tested, and the frontend's report/block/skip/end-session workflows are connected and tested. A client-side age declaration is not sufficient.

## Local development and deployment

Run `npm install`, then `npm run dev`. On Vercel, add environment variables in Project Settings → Environment Variables and redeploy. Check `/api/health`, Supabase logs, and Vercel logs. These changes have not been run through a build in this environment.
