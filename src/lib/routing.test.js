// Establishes the testing convention (Slice 1D: "prepare architecture, not a full suite") —
// pure logic like this is the cheapest, highest-value thing to unit test, since it needs no
// React rendering or Supabase mocking. Run with `npm test`.
import { describe, it, expect } from "vitest";
import { TAB_PATHS, PATH_TABS, tabFromPath, isKnownPath } from "./routing";

describe("tabFromPath", () => {
  it("maps known paths to their tab key", () => {
    expect(tabFromPath("/")).toBe("reps");
    expect(tabFromPath("/pulsemap")).toBe("pulsemap");
    expect(tabFromPath("/demands")).toBe("demands");
    expect(tabFromPath("/discussion")).toBe("discussion");
    expect(tabFromPath("/election")).toBe("election");
    expect(tabFromPath("/admin")).toBe("admin");
  });

  it("treats any /representatives/:id path as the reps tab", () => {
    expect(tabFromPath("/representatives/423")).toBe("reps");
    expect(tabFromPath("/representatives/423/stewardship")).toBe("reps");
  });

  it("falls back to reps for an unrecognized path", () => {
    expect(tabFromPath("/nonexistent-page")).toBe("reps");
  });
});

describe("isKnownPath", () => {
  it("accepts every real route", () => {
    for (const path of Object.values(TAB_PATHS)) {
      expect(isKnownPath(path)).toBe(true);
    }
    expect(isKnownPath("/me")).toBe(true);
    expect(isKnownPath("/representatives/423")).toBe(true);
    expect(isKnownPath("/representatives/423/stewardship")).toBe(true);
  });

  it("rejects a bad/stale rep id shape and unknown paths", () => {
    expect(isKnownPath("/representatives/not-a-number")).toBe(false);
    expect(isKnownPath("/asdkjhasd")).toBe(false);
    expect(isKnownPath("")).toBe(false);
  });
});

describe("TAB_PATHS / PATH_TABS", () => {
  it("are exact inverses of each other", () => {
    for (const [key, path] of Object.entries(TAB_PATHS)) {
      expect(PATH_TABS[path]).toBe(key);
    }
  });
});
