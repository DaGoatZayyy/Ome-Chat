# OmeChat

A Next.js recreation of the supplied OmeChat interface for deployment on Vercel. The visual shell and age/safety flows are included. Live stranger matching and WebRTC require a configured Supabase project and production safety operations; do not treat the UI alone as a production-ready service.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add your Supabase project URL and public anon key.
4. Run `npm run dev` and open http://localhost:3000.

## Deploy to Vercel

Import this GitHub repository in Vercel, set the two `NEXT_PUBLIC_SUPABASE_*` environment variables, then deploy. Vercel hosts the Next.js web app; it is not itself a WebRTC signaling or matchmaking server.

## Before enabling public stranger chat

- The site is intended for adults (18+) and the age prompt is only self-attestation, not verified age assurance.
- Configure reliable age assurance, a privacy policy, terms, a staffed reporting/escalation process, rate limits, abuse prevention, and a documented response process before opening access.
- Add server-enforced queue matching and short-lived match tokens. Never put a Supabase service-role key in browser code.
- Configure TURN as well as STUN for reliable peer connections across restrictive networks.
- Test camera/microphone permission-denied, device-missing, reconnect, skip, report, and disconnect paths on real devices.
- Do not claim that a user is verified or protected unless those systems are actually implemented and tested.

## Current status

The initial commit supplies the responsive landing page and a working local UI flow for consent, mode selection, settings, and chat layout. The public stranger-matching and live video transport are not yet wired up. This is deliberate: the database, age assurance, and moderation controls need to be configured before connecting strangers in real time.
