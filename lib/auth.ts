// V0 login: who is signed in, and are they invited?
// A user must (a) hold a valid Supabase Auth session and (b) appear in the
// app_users allowlist (RLS lets each user read only their own row). APIs call
// this and refuse with 401 otherwise — the AI key and the brain stay closed.
import { supabaseServer } from "@/lib/supabase/server";

export async function requireUser(): Promise<{ email: string } | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return null;
  const { data } = await supabase.from("app_users").select("email").eq("email", email).maybeSingle();
  if (!data) return null; // signed in, but not on the invite list
  return { email };
}
