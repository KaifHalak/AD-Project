import { createClient } from "@supabase/supabase-js";

let browserClient = null;

/**
 * Creates and returns a singleton Supabase client for browser-side usage.
 * This is used in client components and utility functions that run in the browser.
 */
export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
