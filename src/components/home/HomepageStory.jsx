// Slice 1B/1C — composes the homepage storytelling sections between the existing Hero (Slice 1A)
// and the existing app tabs. Lazy-loaded from App.jsx via React.lazy, so this default export is
// required. Order: Slice 1B's product-discovery run first (Comparison/Mission/Live
// Preview/HowItWorks/Audience), then Slice 1C's institutional-trust-building sequence, then the
// shared Public Beta / final CTA / transition into the app tabs.
import "./homepage-story.css";
import { ComparisonCards } from "./ComparisonCards";
import { MissionTimeline } from "./MissionTimeline";
import { LivePreview } from "./LivePreview";
import { HowItWorks } from "./HowItWorks";
import { AudienceCards } from "./AudienceCards";
import { TrustGrid } from "./TrustGrid";
import { AccountabilityStandard } from "./AccountabilityStandard";
import { MethodologySection } from "./MethodologySection";
import { OpenDataPhilosophy } from "./OpenDataPhilosophy";
import { Principles } from "./Principles";
import { Transparency } from "./Transparency";
import { InsightsPreview } from "./InsightsPreview";
import { Roadmap } from "./Roadmap";
import { Newsletter } from "./Newsletter";
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

      <TrustGrid />
      <AccountabilityStandard />
      <MethodologySection />
      <OpenDataPhilosophy />
      <Principles />
      <Transparency />
      <InsightsPreview demandsList={demandsList} repById={repById} phase1Reps={phase1Reps} />
      <Roadmap />
      <Newsletter />

      <BetaSection phase1Reps={phase1Reps} />
      <CTASection user={user} onNavigate={onNavigate} onSignIn={onSignIn} />
      <TransitionSection />
    </div>
  );
}
