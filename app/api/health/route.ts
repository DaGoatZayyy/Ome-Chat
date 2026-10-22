import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Deliberately fail closed: a configured database alone does not mean
  // age assurance, moderation, or matchmaking has been approved for launch.
  const response = {
    app: "ome-chat",
    status: supabaseConfigured ? "setup_required" : "not_configured",
    checks: {
      supabaseEnvironment: supabaseConfigured,
      ageAssurance: false,
      moderationOperations: false,
      matchmakingEnabled: false,
      videoSignalingEnabled: false
    },
    message: "Public matching stays disabled until age assurance, moderation, and server-side matching are implemented and verified."
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
