import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getAuthenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { user: null, error: "Sign in is required." };
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { user: null, error: "Your session is invalid or expired." };
  return { user: data.user, error: null };
}
