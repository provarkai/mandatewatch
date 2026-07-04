import { FileText, Activity, ArrowDown } from "lucide-react";
import { StorySection } from "./StorySection";

const PUBLIC_INFO_ITEMS = [
  "Representative Directory",
  "Government Activity",
  "Legislation",
  "Projects",
  "Official Records",
  "Election Information",
];

const CITIZEN_ITEMS = [
  "PulseMap™",
  "Approval Ratings",
  "Citizen Demands",
  "Community Discussions",
  "Constituency Priorities",
  "Public Sentiment",
];

export function ComparisonCards() {
  return (
    <StorySection
      eyebrow="A different way to understand democracy"
      headline={<>Beyond Public Records.<br />Understanding Public Accountability.</>}
      body={
        <>
          <p>Many platforms help citizens discover representatives, legislation, budgets and official government activity. That information is essential.</p>
          <p>MandateWatch builds on top of that foundation by answering a different question — <em>"What do citizens think about it?"</em></p>
          <p>Rather than simply displaying public information, MandateWatch measures how communities experience governance between elections. Through approval ratings, PulseMap™, citizen demands and community discussions, the platform creates a living picture of democratic accountability.</p>
        </>
      }
    >
      <div className="hs-compare-grid">
        <div className="hs-compare-card">
          <div className="hs-compare-card-icon"><FileText size={18} /></div>
          <h3>Public Information</h3>
          <ul>{PUBLIC_INFO_ITEMS.map((item) => <li key={item}>{item}</li>)}</ul>
          <div className="hs-compare-caption">Shows what happened.</div>
        </div>
        <div className="hs-compare-card hs-compare-card-accent">
          <div className="hs-compare-card-icon"><Activity size={18} /></div>
          <h3>Citizen Accountability</h3>
          <ul>{CITIZEN_ITEMS.map((item) => <li key={item}>{item}</li>)}</ul>
          <div className="hs-compare-caption">Shows how citizens respond.</div>
        </div>
      </div>
      <div className="hs-compare-equation">
        <span>Public Information</span>
        <span className="hs-compare-plus">+</span>
        <span>Citizen Participation</span>
        <ArrowDown size={16} className="hs-compare-arrow" />
        <span className="hs-compare-result">Better Democratic Accountability</span>
      </div>
    </StorySection>
  );
}

export default ComparisonCards;
