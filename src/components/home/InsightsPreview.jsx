import { TrendingUp, MapPin, FileText } from "lucide-react";
import { StorySection } from "./StorySection";

// "Weekly Pulse Report" has no time-windowed backend query yet (out of scope for this slice), so
// it's an honestly-labeled current snapshot rather than a fabricated week-over-week figure.
// "Most Active States" / "Approval Rankings" are computed live from real data already in memory.
export function InsightsPreview({ demandsList, repById, phase1Reps }) {
  const stateCounts = {};
  for (const d of demandsList) {
    const rep = repById[d.repId];
    if (!rep) continue;
    stateCounts[rep.state] = (stateCounts[rep.state] || 0) + 1;
  }
  const topStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topApproval = [...phase1Reps].sort((a, b) => b.approval - a.approval).slice(0, 3);
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const cards = [
    {
      key: "weekly",
      icon: TrendingUp,
      title: "This Week's Pulse",
      summary: `${demandsList.length} demands filed, ${phase1Reps.length} officials tracked so far.`,
    },
    {
      key: "states",
      icon: MapPin,
      title: "Most Active States",
      summary: topStates.length ? topStates.map(([state, count]) => `${state} (${count})`).join(", ") : "No demands filed yet.",
    },
    {
      key: "approval",
      icon: FileText,
      title: "Approval Rankings",
      summary: topApproval.length ? topApproval.map((r) => `${r.name} (${r.approval}%)`).join(", ") : "No ratings yet.",
    },
  ];

  return (
    <StorySection eyebrow="Research & media" headline="Research & Media">
      <div className="hs-insights-grid">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div className="hs-insights-card" key={c.key}>
              <div className="hs-insights-thumb"><Icon size={22} /></div>
              <h3>{c.title}</h3>
              <p>{c.summary}</p>
              <div className="hs-insights-date">{today}</div>
              <button className="hs-link-btn" disabled title="Coming soon">Read Insight</button>
            </div>
          );
        })}
      </div>
    </StorySection>
  );
}

export default InsightsPreview;
