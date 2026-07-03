import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to " +
    ".env.local and fill in your Supabase project's URL and anon key (Project Settings -> API)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Temporary — exposes the real client to the console for direct debugging of a production-only
// signInWithOtp failure. Remove once root-caused.
if (typeof window !== "undefined") {
  window.__supabase = supabase;
  window.__envDiag = {
    isSecureContext: window.isSecureContext,
    hasCryptoSubtle: typeof crypto?.subtle !== "undefined",
    userAgent: navigator.userAgent,
  };
}
