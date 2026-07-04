// Slice 1B — composes the ten homepage storytelling sections in the spec's exact order, between
// the existing Hero (Slice 1A) and the existing app tabs. Lazy-loaded from App.jsx via React.lazy,
// so this default export is required.
import "./homepage-story.css";
import { ComparisonCards } from "./ComparisonCards";
import { MissionTimeline } from "./MissionTimeline";
import { LivePreview } from "./LivePreview";
import { HowItWorks } from "./HowItWorks";
import { AudienceCards } from "./AudienceCards";
import { MethodologySection } from "./MethodologySection";
import { TrustGrid } from "./TrustGrid";
import { InsightsPreview } from "./InsightsPreview";
import { BetaSection } from "./BetaSection";
import { CTASection } from "./CTASection";
import { TransitionSection } from "./TransitionSection";

export default function HomepageStory({ phase1Reps, demandsList, threadsList, repById, user, onNavigate, onSignIn }) {
  return (
    <div className="hs-root">
      <ComparisonCards />
      <MissionTimeline />
      <LivePreview phase1Reps={phase1Reps} demandsList={demandsList} threadsList={threadsList} repById={repById} onNavigate={onNavigate} />
      <HowItWorks onNavigate={onNavigate} />
      <AudienceCards />
      <MethodologySection />
      <TrustGrid />
      <InsightsPreview demandsList={demandsList} repById={repById} phase1Reps={phase1Reps} />
      <BetaSection phase1Reps={phase1Reps} />
      <CTASection user={user} onNavigate={onNavigate} onSignIn={onSignIn} />
      <TransitionSection />
    </div>
  );
}
