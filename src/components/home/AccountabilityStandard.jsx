import { Scale, Link2, UserCheck, Landmark } from "lucide-react";
import { StorySection } from "./StorySection";

const STANDARDS = [
  { icon: Scale, title: "Equal Standard for Every Official", description: "Every representative is tracked the same way — same formula, same visibility — regardless of party, seniority, or region." },
  { icon: Link2, title: "Every Score Traces to a Source", description: "Approval percentages, demand counts, and discussion scores are all backed by real recorded actions — never estimated or projected." },
  { icon: UserCheck, title: "No Anonymous Manipulation", description: "Every vote, demand, and discussion post ties to a real signed-in account. One person, one voice, per action." },
  { icon: Landmark, title: "Public Before Political", description: "MandateWatch reports what citizens experience, not what any party, office, or campaign prefers be shown." },
];

export function AccountabilityStandard() {
  return (
    <StorySection
      eyebrow="A core pillar of the platform"
      headline="The Accountability Standard"
      body={<p>Not a policy page — the actual standard MandateWatch holds itself to on every representative, every score, and every citizen action.</p>}
    >
      <div className="hs-standard-grid">
        {STANDARDS.map((s) => {
          const Icon = s.icon;
          return (
            <div className="hs-standard-card" key={s.title}>
              <div className="hs-standard-icon"><Icon size={18} /></div>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
            </div>
          );
        })}
      </div>
    </StorySection>
  );
}

export default AccountabilityStandard;
