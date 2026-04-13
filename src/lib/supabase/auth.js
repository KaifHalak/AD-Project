import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";

/**
 * Signs up a new user with email and password.
 * Returns Supabase data and error so the caller can handle UI messages.
 */
export async function signUpWithEmail(email, password) {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.signUp({ email, password });
}

/**
 * Signs in an existing user with email and password.
 * Returns Supabase data and error to keep control in the calling component.
 */
export async function signInWithEmail(email, password) {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Signs out the currently logged-in user.
 * This clears the local Supabase session in the browser.
 */
export async function signOutUser() {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.signOut();
}

/**
 * Gets the current auth session from Supabase.
 * Useful for checking whether a user is currently authenticated.
 */
export async function getCurrentSession() {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.getSession();
}

/**
 * Gets the currently authenticated user from Supabase.
 * Useful for displaying profile data after login.
 */
export async function getCurrentUser() {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.getUser();
}
