import { createClient } from "@supabase/supabase-js";
/**
 * Creates a Supabase client for server-side usage.
 * Session persistence is disabled because API routes are stateless.
 */
export function getSupabaseServerClient(accessToken = "") {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const options = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  };

  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  return createClient(supabaseUrl, supabaseAnonKey, options);
}
