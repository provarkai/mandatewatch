import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

// Combines a Supabase Auth session with its matching profiles row into the flat shape the
// rest of the app already reads: { id, email, name, phone, state, lga }. Returns null if no
// profiles row exists yet — e.g. right after clicking a magic-link email for the first time,
// before the signup "details" step (name/phone/state/lga) has been completed.
async function loadProfile(sessionUser) {
  if (!sessionUser) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, phone, state_code, lga")
    .eq("id", sessionUser.id)
    .maybeSingle();
  if (!profile) return null;
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name: profile.name,
    phone: profile.phone,
    state: profile.state_code,
    lga: profile.lga,
  };
}

export function useAuth() {
  const [user, setUser] = useState(null);       // fully signed in: session + profile row
  const [authUser, setAuthUser] = useState(null); // raw Supabase auth user, may exist without a profile
  const [loading, setLoading] = useState(true);

  async function sync(sessionUser) {
    // Resolve the profile BEFORE setting either piece of state, then set both together.
    // Setting authUser first (before the profile fetch resolves) creates a render where
    // authUser is truthy but user is still null -- which needsProfile below reads as "signed
    // in but never finished signup," incorrectly popping the signup modal open for a user
    // who's actually fully signed in and just waiting on this same async lookup to finish.
    const profile = await loadProfile(sessionUser);
    setAuthUser(sessionUser);
    setUser(profile);
  }

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await sync(session?.user ?? null);
      if (!cancelled) setLoading(false);
    });

    // Fires when a magic-link click lands back on the app (a brand-new session appearing),
    // and keeps `user` in sync with sign-out from this tab or another.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await sync(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // True right after a magic-link click for someone who has never finished signup —
  // an auth session exists, but there's no profiles row (name/phone/state/lga) yet.
  const needsProfile = !!authUser && !user;

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthUser(null);
  }, []);

  return { user, setUser, authUser, needsProfile, loading, signOut };
}
