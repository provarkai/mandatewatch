import { ArrowRight } from "lucide-react";
import { StorySection } from "./StorySection";
import { usePlatform } from "../../platform/usePlatform";

export function CTASection({ user, onNavigate, onSignIn }) {
  const platform = usePlatform();
  return (
    <StorySection
      tone="cta"
      headline="Democracy Doesn't End On Election Day."
      body={<p>Join Nigerians helping build a more transparent and accountable democracy.</p>}
    >
      <div className="hs-cta-actions">
        <button className="hs-cta-primary" onClick={() => onNavigate("reps")}>
          {platform.cta.exploreRepresentatives} <ArrowRight size={14} />
        </button>
        {!user && (
          <button className="hs-cta-secondary" onClick={onSignIn}>{platform.cta.signInSignUp}</button>
        )}
      </div>
    </StorySection>
  );
}

export default CTASection;
