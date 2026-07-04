import { ShieldCheck, BookOpen, Users, Lock, Scale, BarChart3 } from "lucide-react";
import { StorySection } from "./StorySection";

const PILLARS = [
  { icon: ShieldCheck, title: "Independent", description: "MandateWatch isn't funded or influenced by any political party, government agency, or candidate." },
  { icon: BookOpen, title: "Open Methodology", description: "Every score is built from a documented, publicly explained formula — never a black box." },
  { icon: Users, title: "Citizen Powered", description: "Approval ratings, demands, and discussions come directly from real citizens, not internal editorial judgment." },
  { icon: Lock, title: "Privacy First", description: "Your phone number and personal details are never shown publicly — only what you choose to share." },
  { icon: Scale, title: "Non-Partisan", description: "We track every party and every official the same way, with the same standard." },
  { icon: BarChart3, title: "Data Driven", description: "Every number on this platform is backed by a real vote, demand, or discussion — nothing is estimated." },
];

export function TrustGrid() {
  return (
    <StorySection eyebrow="Why trust MandateWatch" headline="Built On Transparency" tone="institutional">
      <div className="hs-trust-grid">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <div className="hs-trust-card" key={p.title}>
              <div className="hs-trust-icon"><Icon size={18} /></div>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
            </div>
          );
        })}
      </div>
    </StorySection>
  );
}

export default TrustGrid;
