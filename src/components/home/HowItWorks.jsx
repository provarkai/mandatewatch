import { Search, TrendingUp, MessageSquare, ArrowRight } from "lucide-react";
import { StorySection } from "./StorySection";
import { usePlatform } from "../../platform/usePlatform";

const STEPS = [
  {
    number: "01",
    icon: Search,
    title: "Find Your Representative",
    description: "Search by name, state, or constituency to find the officials representing you — governors, senators, House members, and state assembly reps.",
  },
  {
    number: "02",
    icon: TrendingUp,
    title: "Understand The Pulse",
    description: "See real approval ratings and felt-presence scores built entirely from citizen votes, plus a map of how every state is responding.",
  },
  {
    number: "03",
    icon: MessageSquare,
    title: "Participate",
    description: "File a demand, join a discussion, or cast your vote — every action feeds directly into that representative's public record.",
  },
];

export function HowItWorks({ onNavigate }) {
  const platform = usePlatform();
  return (
    <StorySection eyebrow="How it works" headline="Three Steps To Holding Leaders Accountable">
      <div className="hs-steps">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div className="hs-step" key={step.number}>
              <div className="hs-step-number">{step.number}</div>
              <div className="hs-step-icon"><Icon size={20} /></div>
              <h3 className="hs-step-title">{step.title}</h3>
              <p className="hs-step-desc">{step.description}</p>
            </div>
          );
        })}
      </div>
      <button className="hs-cta-btn" onClick={() => onNavigate("/")}>
        {platform.cta.exploreRepresentatives} <ArrowRight size={14} />
      </button>
    </StorySection>
  );
}

export default HowItWorks;
