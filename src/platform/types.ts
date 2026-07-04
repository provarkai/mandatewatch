// Platform Architecture Layer — Slice 1A. Types for the centralized platform config consumed via
// usePlatform(). See CLAUDE.md for the architecture decisions behind this layer.

import type { PRODUCT_STATUS, MARKET_STATUS, SUPPORTED_LOCALES } from "./constants";

export type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];
export type MarketStatus = (typeof MARKET_STATUS)[keyof typeof MARKET_STATUS];
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export interface Market {
  code: string;
  name: string;
  status: MarketStatus;
}

export interface BrandConfig {
  mission: string;
  brandPromise: string; // three imperative clauses, "."-joined — see platform.config.ts
  marketPosition: string; // template, "{country}" substituted at runtime for the current market
  rolloutMessage: string;
  values: string[];
}

export interface ProductModuleEntry {
  key: string;
  label: string;
  status: ProductStatus;
  /** The real URL path this product renders at, if it's a standalone nav destination. */
  path?: string;
}

export interface NavigationItem {
  key: string;
  label: string;
  path: string;
}

export interface FooterLink {
  label: string;
  /** Real in-app URL path (react-router) — this SPA has a router now, but not every column's
   * destinations exist as real pages yet, so this stays optional. */
  path?: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterConfig {
  disclaimer: string;
  columns: FooterColumn[];
  social: string[]; // empty until real social accounts exist — see CLAUDE.md decision 2
}

export interface CtaLabels {
  signInSignUp: string;
  signOut: string;
  fileADemand: string;
  startADiscussion: string;
  exploreRepresentatives: string;
  explorePulseMap: string;
  viewInsights: string;
  subscribe: string;
  readReport: string;
  learnMore: string;
}

export interface SeoConfig {
  title: string;
  description: string;
  keywords: string[];
  siteUrl: string;
  twitterCard: string;
}

export interface FeatureFlags {
  // Election Mode is deliberately NOT here — it already has a real, live, Supabase-backed toggle
  // (app_settings.election_mode_enabled). See CLAUDE.md decision on this.
  pulseMap: boolean;
  reports: boolean;
  api: boolean;
  notifications: boolean;
  ninVerification: boolean;
  darkMode: boolean;
  realtimeUpdates: boolean;
  aiInsights: boolean;
}

export interface RolloutConfig {
  market: string;
  launchStrategyMessage: string;
  launchStates: string[];
}

export interface DesignTokens {
  colors: {
    ink: string;
    inkSoft: string;
    verdant: string;
    verdantDark: string;
    brass: string;
    brassSoft: string;
    brassDark: string;
    rust: string;
    paper: string;
    paperCard: string;
    line: string;
  };
  typography: {
    heading: string;
    body: string;
    mono: string;
  };
}

export interface PlatformContextValue {
  brand: BrandConfig;
  markets: Market[];
  currentMarket: Market;
  marketPosition: string;
  products: ProductModuleEntry[];
  navigation: NavigationItem[];
  cta: CtaLabels;
  footer: FooterConfig;
  seo: SeoConfig;
  featureFlags: FeatureFlags;
  rollout: RolloutConfig;
  designTokens: DesignTokens;
  locale: Locale;
  environment: string;
}
