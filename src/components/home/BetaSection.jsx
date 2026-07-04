import { StorySection } from "./StorySection";
import { usePlatform } from "../../platform/usePlatform";

// The state count is computed from real data, not the spec's static placeholder number -- so it
// never silently drifts from what's actually seeded, same principle applied all session.
export function BetaSection({ phase1Reps }) {
  const platform = usePlatform();
  const stateCount = new Set(phase1Reps.map((r) => r.state)).size;

  return (
    <StorySection
      eyebrow="Public beta"
      headline="Growing One Community At A Time"
      body={
        <>
          <p>MandateWatch is available nationwide. Representative profiles can already be explored across Nigeria.</p>
          <p>Interactive community features — filing demands, joining discussions — are currently active in:</p>
        </>
      }
    >
      <div className="hs-beta-badges">
        {platform.rollout.launchStates.map((state) => (
          <span className="hs-beta-badge" key={state}>{state}</span>
        ))}
      </div>
      <div className="hs-beta-stat">
        <span className="hs-beta-stat-number">{stateCount} States</span>
        <span className="hs-beta-stat-label">Rolling Out</span>
      </div>
    </StorySection>
  );
}

export default BetaSection;
