import { createClient } from "@supabase/supabase-js";

// Public client — safe to use in the browser. Can only do what RLS policies allow:
// read clips/votes/comments/settings, insert votes/comments.
export function supabasePublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Admin client — SERVER ONLY. Uses the service role key, which bypasses RLS.
// Never import this into a client component or expose the key to the browser.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
