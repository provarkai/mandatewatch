import { StorySection } from "./StorySection";

// The state count and the launch-state badges are both computed from real, fetched data -- not
// the static platform.rollout.launchStates placeholder -- so what's displayed can never drift
// from what's actually enforced server-side (see supabase/migrations/0007_pilot_launch_states.sql
// and the launch_states fetch in App.jsx).
export function BetaSection({ phase1Reps, launchStates }) {
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
        {launchStates.map((state) => (
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
