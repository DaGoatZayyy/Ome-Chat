import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const categories = new Set(["harassment", "sexual_content", "underage_concern", "threats", "spam", "other"]);

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  let input: { matchId?: unknown; category?: unknown; details?: unknown };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (typeof input.matchId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.matchId) ||
      typeof input.category !== "string" || !categories.has(input.category) ||
      (input.details !== undefined && typeof input.details !== "string")) {
    return NextResponse.json({ error: "A valid matchId and report category are required." }, { status: 400 });
  }
  const details = typeof input.details === "string" ? input.details.trim().slice(0, 2000) : null;
  const admin = getSupabaseAdmin();
  const { data: match, error: matchError } = await admin.from("chat_matches")
    .select("id,user_a,user_b,status")
    .eq("id", input.matchId)
    .or(`user_a.eq.${auth.user.id},user_b.eq.${auth.user.id}`)
    .maybeSingle();
  if (matchError) return NextResponse.json({ error: "Could not check conversation." }, { status: 503 });
  if (!match) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const reportedUserId = match.user_a === auth.user.id ? match.user_b : match.user_a;
  const { error: reportError } = await admin.from("chat_reports").insert({
    match_id: match.id,
    reporter_id: auth.user.id,
    reported_user_id: reportedUserId,
    category: input.category,
    details,
  });
  if (reportError) return NextResponse.json({ error: "Could not submit report. Please try again." }, { status: 503 });

  // Prevent the two accounts from being matched again after a report.
  await admin.from("chat_blocks").upsert(
    { blocker_id: auth.user.id, blocked_id: reportedUserId },
    { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true }
  );
  if (match.status === "active") {
    await admin.from("chat_matches").update({ status: "reported", ended_at: new Date().toISOString() })
      .eq("id", match.id).eq("status", "active");
  }
  await admin.from("chat_queue").delete().eq("user_id", auth.user.id);
  return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
