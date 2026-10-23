import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdminEmail(email: string | undefined) {
  const configured = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && configured.includes(email.toLowerCase()));
}

async function requireAdmin(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) {
    return { response: NextResponse.json({ error: auth.error }, { status: 401 }) };
  }
  if (!isAdminEmail(auth.user.email)) {
    return { response: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  return { user: auth.user };
}

export async function GET(request: Request) {
  const checked = await requireAdmin(request);
  if ("response" in checked) return checked.response;

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (authError) {
    console.error("admin list users failed", authError.message);
    return NextResponse.json({ error: "Could not load accounts." }, { status: 503 });
  }

  const ids = authData.users.map(user => user.id);
  const { data: profiles, error: profileError } = ids.length
    ? await admin.from("chat_profiles")
        .select("user_id,age_verified,age_verified_at,verification_provider,country_code,interests,banned_at,created_at,updated_at")
        .in("user_id", ids)
    : { data: [], error: null };

  if (profileError) {
    console.error("admin list profiles failed", profileError.message);
    return NextResponse.json({ error: "Could not load chat profiles. Apply the database migrations." }, { status: 503 });
  }

  const profileById = new Map((profiles ?? []).map(profile => [profile.user_id, profile]));
  const users = authData.users.map(user => ({
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at,
    profile: profileById.get(user.id) ?? null,
  }));

  return NextResponse.json({
    users,
    page: 1,
    perPage: 200,
    hasMore: authData.users.length === 200,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const checked = await requireAdmin(request);
  if ("response" in checked) return checked.response;

  let input: { userId?: unknown; action?: unknown; note?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (typeof input.userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.userId) ||
      (input.action !== "approve_age" && input.action !== "revoke_age") ||
      typeof input.note !== "string" ||
      input.note.trim().length < 10 || input.note.trim().length > 2000) {
    return NextResponse.json({
      error: "Provide a valid user ID, action, and review note of 10–2000 characters.",
    }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: target, error: targetError } = await admin.auth.admin.getUserById(input.userId);
  if (targetError || !target.user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const approving = input.action === "approve_age";
  const now = new Date().toISOString();
  const { data: existing, error: profileReadError } = await admin.from("chat_profiles")
    .select("user_id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (profileReadError) {
    return NextResponse.json({ error: "Could not check the chat profile." }, { status: 503 });
  }

  if (!existing) {
    const { error: createError } = await admin.from("chat_profiles").insert({ user_id: input.userId });
    if (createError) {
      console.error("admin profile create failed", createError.message);
      return NextResponse.json({ error: "Could not create the chat profile." }, { status: 503 });
    }
  }

  const { error: updateError } = await admin.from("chat_profiles").update({
    age_verified: approving,
    age_verified_at: approving ? now : null,
    verification_provider: approving ? "admin_review" : null,
    updated_at: now,
  }).eq("user_id", input.userId);

  if (updateError) {
    console.error("admin age review update failed", updateError.message);
    return NextResponse.json({ error: "Could not update the age-review status." }, { status: 503 });
  }

  const { error: auditError } = await admin.from("chat_age_review_audit").insert({
    actor_user_id: checked.user.id,
    target_user_id: input.userId,
    action: approving ? "approved" : "revoked",
    note: input.note.trim(),
  });

  if (auditError) {
    console.error("admin age review audit failed", auditError.message);
    // Fail closed: undo an approval/revocation if its audit record cannot be saved.
    await admin.from("chat_profiles").update({
      age_verified: false,
      age_verified_at: null,
      verification_provider: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId);
    return NextResponse.json({ error: "Could not save the audit record; the profile was reset to unverified." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    userId: input.userId,
    age_verified: approving,
    age_verified_at: approving ? now : null,
    verification_provider: approving ? "admin_review" : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
