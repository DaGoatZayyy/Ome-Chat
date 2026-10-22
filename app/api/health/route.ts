import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverSecret =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseConfigured = Boolean(supabaseUrl && publishableKey && serverSecret);

  // A configured database is not evidence that production chat is safe or ready.
  const response = {
    app: "ome-chat",
    status: supabaseConfigured ? "setup_required" : "not_configured",
    checks: {
      supabaseEnvironment: supabaseConfigured,
      ageAssurance: false,
      moderationOperations: false,
      matchmakingEnabled: false,
      videoSignalingEnabled: false,
    },
    message:
      "Live matching remains disabled until authentication, moderation, and secure server-side matching are implemented and tested.",
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
