// Platform Architecture Layer — Slice 1A. Literal-union helpers shared by types.ts and
// platform.config.ts, following the same plain-named-export convention as src/data/*.js.

export const PRODUCT_STATUS = {
  LIVE: "live",
  UNRELEASED: "unreleased",
} as const;

export const MARKET_STATUS = {
  CURRENT: "current",
  FUTURE: "future",
} as const;

// Locales this architecture is ready for — none are implemented yet (see CLAUDE.md).
export const SUPPORTED_LOCALES = ["en", "fr", "sw", "ar", "pt"] as const;
