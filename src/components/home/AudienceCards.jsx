import { Users, Newspaper, BookOpen, Megaphone, Landmark, GraduationCap } from "lucide-react";
import { StorySection } from "./StorySection";

const AUDIENCES = [
  {
    icon: Users,
    title: "Citizens",
    description: "Track your representative's approval rating, file demands for your constituency, and see how your community is responding to governance in real time.",
  },
  {
    icon: Newspaper,
    title: "Journalists",
    description: "Pull verified approval trends and constituency sentiment to ground investigative reporting in what citizens are actually experiencing.",
  },
  {
    icon: BookOpen,
    title: "Researchers",
    description: "Access structured, citizen-generated accountability data across states and chambers for comparative governance research.",
  },
  {
    icon: Megaphone,
    title: "Civil Society",
    description: "Monitor which demands get acknowledged versus ignored, and mobilize constituents around the issues that matter most in their LGA.",
  },
  {
    icon: Landmark,
    title: "Policy Makers",
    description: "See which projects and promises citizens are actually responding to, state by state, to prioritize what to act on next.",
  },
  {
    icon: GraduationCap,
    title: "Students",
    description: "Study real, ongoing democratic accountability in action — approval data, citizen demands, and public discussion, not textbook theory.",
  },
];

export function AudienceCards() {
  return (
    <StorySection eyebrow="Who it's built for" headline="Built For Everyone Who Cares About Better Governance">
      <div className="hs-audience-grid">
        {AUDIENCES.map((a) => {
          const Icon = a.icon;
          return (
            <div className="hs-audience-card" key={a.title}>
              <div className="hs-audience-icon"><Icon size={18} /></div>
              <h3>{a.title}</h3>
              <p>{a.description}</p>
            </div>
          );
        })}
      </div>
    </StorySection>
  );
}

export default AudienceCards;
