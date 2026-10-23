import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  let input: { mode?: unknown; countryCode?: unknown; interests?: unknown };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (input.mode !== "text" && input.mode !== "video") {
    return NextResponse.json({ error: "mode must be text or video." }, { status: 400 });
  }
  const countryCode = typeof input.countryCode === "string" && /^[A-Z]{2}$/.test(input.countryCode) ? input.countryCode : null;
  const interests = Array.isArray(input.interests)
    ? input.interests.filter((value): value is string => typeof value === "string").map(value => value.trim().slice(0, 40)).filter(Boolean).slice(0, 10)
    : [];

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin.from("chat_profiles")
    .select("age_verified,banned_at").eq("user_id", auth.user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Could not check account eligibility." }, { status: 503 });
  if (!profile?.age_verified || profile.banned_at) {
    return NextResponse.json({ error: "An eligible, non-restricted account is required." }, { status: 403 });
  }

  const { data, error } = await admin.rpc("omechat_enqueue_and_match", {
    p_user_id: auth.user.id, p_mode: input.mode, p_country_code: countryCode, p_interests: interests,
  });
  if (error) {
    console.error("queue rpc failed", error.message);
    return NextResponse.json({ error: "Matching is not configured. Apply the latest Supabase migration first." }, { status: 503 });
  }
  const result = Array.isArray(data) ? data[0] : data;
  return NextResponse.json(result ?? { status: "queued" }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("chat_queue").delete().eq("user_id", auth.user.id);
  if (error) return NextResponse.json({ error: "Could not cancel queue entry." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
