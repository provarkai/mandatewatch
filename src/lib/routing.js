// Routing shims — map the small set of logical "tab" keys used throughout App.jsx to real URL
// paths, so every existing `tab === "x"` / `setTab("x")` call site keeps working unchanged while
// the actual navigation state lives in the URL (see MandateWatch in App.jsx for the derived
// tab/setTab/openRepId/etc. values built from these). Pulled into its own module (rather than
// living inline in App.jsx) specifically so this pure logic is unit-testable — see
// src/lib/routing.test.js.

export const TAB_PATHS = { reps: "/", pulsemap: "/pulsemap", demands: "/demands", discussion: "/discussion", election: "/election", admin: "/admin" };
export const PATH_TABS = Object.fromEntries(Object.entries(TAB_PATHS).map(([key, path]) => [path, key]));

export function tabFromPath(pathname) {
  if (pathname.startsWith("/representatives/")) return "reps";
  return PATH_TABS[pathname] ?? "reps";
}

export function isKnownPath(pathname) {
  if (pathname === "/me") return true;
  if (Object.values(TAB_PATHS).includes(pathname)) return true;
  if (/^\/representatives\/\d+(\/stewardship)?$/.test(pathname)) return true;
  return false;
}
