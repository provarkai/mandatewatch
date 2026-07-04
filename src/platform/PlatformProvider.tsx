// Platform Architecture Layer — Slice 1A. Root configuration provider for the entire application.
// Wraps <App /> in main.jsx. See CLAUDE.md for the architecture decisions behind this layer.

import { useMemo, type ReactNode } from "react";
import {
  BRAND,
  MARKETS,
  CURRENT_MARKET_CODE,
  PRODUCTS,
  NAVIGATION,
  CTA_LABELS,
  FOOTER,
  SEO,
  FEATURE_FLAGS,
  ROLLOUT,
  DESIGN_TOKENS,
} from "./platform.config";
import type { PlatformContextValue } from "./types";
import { PlatformContext } from "./PlatformContext";

export function PlatformProvider({ children }: { children: ReactNode }) {
  const value = useMemo<PlatformContextValue>(() => {
    const currentMarket = MARKETS.find((m) => m.code === CURRENT_MARKET_CODE) ?? MARKETS[0];
    return {
      brand: BRAND,
      markets: MARKETS,
      currentMarket,
      marketPosition: BRAND.marketPosition.replace("{country}", currentMarket.name),
      products: PRODUCTS,
      navigation: NAVIGATION,
      cta: CTA_LABELS,
      footer: FOOTER,
      seo: SEO,
      featureFlags: FEATURE_FLAGS,
      rollout: ROLLOUT,
      designTokens: DESIGN_TOKENS,
      locale: "en",
      environment: import.meta.env.MODE,
    };
  }, []);

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}
