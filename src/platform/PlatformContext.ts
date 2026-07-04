// Split out from PlatformProvider.tsx so that file only exports the component (Vite Fast Refresh
// requirement) -- this context has no logic of its own, just the shared React context object.
import { createContext } from "react";
import type { PlatformContextValue } from "./types";

export const PlatformContext = createContext<PlatformContextValue | null>(null);
