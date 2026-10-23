import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function eligibleMatch(userId: string, matchId: string) {
  const admin = getSupabaseAdmin();
  const { data: match, error } = await admin.from("chat_matches")
    .select("id,user_a,user_b,status")
    .eq("id", matchId).eq("status", "active")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`).maybeSingle();
  if (error || !match) return null;
  const { data: profile } = await admin.from("chat_profiles")
    .select("age_verified,banned_at").eq("user_id", userId).maybeSingle();
  if (!profile?.age_verified || profile.banned_at) return null;
  return match;
}

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });
  const url = new URL(request.url);
  const matchId = url.searchParams.get("matchId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) return NextResponse.json({ error: "Invalid matchId." }, { status: 400 });
  if (!await eligibleMatch(auth.user.id, matchId)) return NextResponse.json({ error: "Active match not found." }, { status: 403 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("chat_messages").select("id,match_id,sender_id,body,created_at")
    .eq("match_id", matchId).order("created_at", { ascending: true }).limit(100);
  if (error) return NextResponse.json({ error: "Could not load messages." }, { status: 503 });
  return NextResponse.json({ messages: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });
  let input: { matchId?: unknown; body?: unknown };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (typeof input.matchId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.matchId) ||
      typeof input.body !== "string" || !input.body.trim() || input.body.trim().length > 2000) {
    return NextResponse.json({ error: "A valid matchId and message (1–2000 characters) are required." }, { status: 400 });
  }
  if (!await eligibleMatch(auth.user.id, input.matchId)) return NextResponse.json({ error: "Active match not found." }, { status: 403 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("chat_messages").insert({
    match_id: input.matchId, sender_id: auth.user.id, body: input.body.trim(),
  }).select("id,match_id,sender_id,body,created_at").single();
  if (error) return NextResponse.json({ error: "Could not send message." }, { status: 503 });
  return NextResponse.json({ message: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
