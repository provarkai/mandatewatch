// Platform Architecture Layer — Slice 1A.
import { useContext } from "react";
import { PlatformContext } from "./PlatformContext";
import type { PlatformContextValue } from "./types";

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform must be used within a PlatformProvider");
  return ctx;
}
