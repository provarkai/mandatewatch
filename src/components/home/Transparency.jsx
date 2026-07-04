import { FileSearch, AlertTriangle } from "lucide-react";
import { StorySection } from "./StorySection";
import { usePlatform } from "../../platform/usePlatform";

// Reuses the real sourcing/coverage facts already in platform.footer.disclaimer instead of
// re-authoring separate transparency claims from scratch.
export function Transparency() {
  const platform = usePlatform();
  return (
    <StorySection
      eyebrow="Transparency"
      headline="Transparency"
      body={
        <>
          <p><FileSearch size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />{platform.footer.disclaimer}</p>
        </>
      }
    >
      <div className="hs-transparency-note">
        <AlertTriangle size={16} />
        <span>Directory coverage is intentionally disclosed, not hidden — the platform grows in the open, not behind a claim of completeness it hasn't earned yet.</span>
      </div>
    </StorySection>
  );
}

export default Transparency;
