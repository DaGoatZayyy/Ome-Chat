import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns ICE server config only to authenticated, server-verified age-eligible
 * accounts. TURN REST credentials are short-lived; TURN_REST_SECRET stays server-side.
 */
export async function GET(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const adminKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !adminKey) {
    return NextResponse.json({ error: "Video calling is not configured." }, { status: 503 });
  }

  const { data: profile, error } = await (await import("@/lib/server/supabase-admin"))
    .getSupabaseAdmin().from("chat_profiles")
    .select("age_verified,banned_at")
    .eq("user_id", auth.user.id).maybeSingle();

  if (error || !profile?.age_verified || profile.banned_at) {
    return NextResponse.json({ error: "An eligible account is required for video calling." }, { status: 403 });
  }

  const iceServers: RTCIceServer[] = [];
  const stunUrls = (process.env.STUN_URLS ?? "stun:stun.l.google.com:19302")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (stunUrls.length) iceServers.push({ urls: stunUrls });

  const turnUrls = (process.env.TURN_URLS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const turnSecret = process.env.TURN_REST_SECRET;
  if (turnUrls.length && turnSecret) {
    const ttl = 60 * 10;
    const username = `${Math.floor(Date.now() / 1000) + ttl}:${auth.user.id}`;
    const credential = createHmac("sha1", turnSecret).update(username).digest("base64");
    iceServers.push({ urls: turnUrls, username, credential });
  }

  if (!iceServers.length) return NextResponse.json({ error: "No STUN/TURN server is configured." }, { status: 503 });
  return NextResponse.json({ iceServers }, {
    headers: { "Cache-Control": "no-store", "Vary": "Authorization" },
  });
}
