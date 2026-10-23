import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("chat_matches")
    .select("id,user_a,user_b,mode,status,created_at")
    .eq("status", "active")
    .or(`user_a.eq.${auth.user.id},user_b.eq.${auth.user.id}`)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not check active chat." }, { status: 503 });
  return NextResponse.json({ match: data ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });
  const url = new URL(request.url);
  const matchId = url.searchParams.get("matchId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) return NextResponse.json({ error: "Invalid matchId." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: match, error: lookupError } = await admin.from("chat_matches")
    .select("id,user_a,user_b,status")
    .eq("id", matchId).eq("status", "active")
    .or(`user_a.eq.${auth.user.id},user_b.eq.${auth.user.id}`)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Could not check active chat." }, { status: 503 });
  if (!match) return NextResponse.json({ error: "Active chat not found." }, { status: 404 });

  const { error } = await admin.from("chat_matches")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", matchId).eq("status", "active");
  if (error) return NextResponse.json({ error: "Could not end chat." }, { status: 503 });
  await admin.from("chat_queue").delete().eq("user_id", auth.user.id);
  return NextResponse.json({ ok: true });
}
