import { CheckCircle2, Landmark, Users, Eye, TrendingUp, ArrowDown } from "lucide-react";
import { StorySection } from "./StorySection";

const STEPS = [
  { label: "Election", icon: CheckCircle2 },
  { label: "Governance", icon: Landmark },
  { label: "Citizen Participation", icon: Users },
  { label: "Public Accountability", icon: Eye },
  { label: "Better Democracy", icon: TrendingUp },
];

export function MissionTimeline() {
  return (
    <StorySection
      eyebrow="Making accountability visible"
      headline="Making Accountability Visible"
      body={
        <>
          <p>Every election creates a mandate. But what happens between elections often becomes invisible.</p>
          <p>MandateWatch exists to make governance measurable. We believe accountability should be visible, understandable and accessible to everyone.</p>
        </>
      }
    >
      <div className="hs-timeline">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div className="hs-timeline-step" key={step.label}>
              <div className="hs-timeline-icon"><Icon size={20} /></div>
              <div className="hs-timeline-label">{step.label}</div>
              {i < STEPS.length - 1 && <ArrowDown size={14} className="hs-timeline-arrow" />}
            </div>
          );
        })}
      </div>
    </StorySection>
  );
}

export default MissionTimeline;
