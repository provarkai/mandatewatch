import { Unlock, Code2 } from "lucide-react";
import { StorySection } from "./StorySection";
import { usePlatform } from "../../platform/usePlatform";

export function OpenDataPhilosophy() {
  const platform = usePlatform();
  const apiPlanned = platform.products.find((p) => p.key === "openCivicApi");

  return (
    <StorySection
      eyebrow="Open data philosophy"
      headline="Accountability Data Shouldn't Be Locked Away"
      body={
        <>
          <p>Governance data that only one organization can see isn't really accountable to anyone. MandateWatch's methodology is published, not proprietary, and every score can be traced back to the citizen actions that produced it.</p>
        </>
      }
    >
      {apiPlanned && (
        <div className="hs-opendata-note">
          <Unlock size={16} />
          <div>
            <strong>{apiPlanned.label}</strong> is planned so researchers and developers can build directly on this data — not yet available.
          </div>
          <Code2 size={16} className="hs-opendata-note-secondary" />
        </div>
      )}
    </StorySection>
  );
}

export default OpenDataPhilosophy;
