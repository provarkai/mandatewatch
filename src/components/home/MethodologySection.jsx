import { ThumbsUp, FileText, MessageSquare, Activity, ArrowDown } from "lucide-react";
import { StorySection } from "./StorySection";

const INPUTS = [
  { icon: ThumbsUp, label: "Poll Participation" },
  { icon: FileText, label: "Citizen Demands" },
  { icon: MessageSquare, label: "Community Discussions" },
  { icon: Activity, label: "Representative Activity" },
];

export function MethodologySection() {
  return (
    <StorySection
      eyebrow="How we measure"
      headline="Transparent Methodology"
      body={<p>MandateWatch combines citizen participation with transparent public data to measure accountability between elections.</p>}
    >
      <div className="hs-methodology-inputs">
        {INPUTS.map((input, i) => {
          const Icon = input.icon;
          return (
            <span className="hs-methodology-input" key={input.label}>
              <Icon size={16} /> {input.label}
              {i < INPUTS.length - 1 && <span className="hs-methodology-plus">+</span>}
            </span>
          );
        })}
      </div>
      <ArrowDown size={16} className="hs-methodology-arrow" />
      <div className="hs-methodology-result">Pulse Score</div>

      <div className="hs-methodology-note">
        Pulse Scores reflect participation and public sentiment. They are <b>not</b> election predictions. They do <b>not</b> endorse political candidates.
      </div>

      <button className="hs-link-btn" disabled title="Coming soon">Learn More About Our Methodology</button>
    </StorySection>
  );
}

export default MethodologySection;
