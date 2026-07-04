import { TrendingUp, Users, MessageSquare, MapPin, ArrowRight } from "lucide-react";
import { StorySection } from "./StorySection";
import { usePlatform } from "../../platform/usePlatform";

export function LivePreview({ phase1Reps, demandsList, threadsList, repById, onNavigate }) {
  const platform = usePlatform();

  const topRep = phase1Reps.length ? [...phase1Reps].sort((a, b) => b.approval - a.approval)[0] : null;

  const latestDemand = demandsList.length
    ? [...demandsList].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
    : null;
  const latestDemandRep = latestDemand ? repById[latestDemand.repId] : null;

  const trendingThread = threadsList.length ? [...threadsList].sort((a, b) => b.score - a.score)[0] : null;

  // A simple, honest aggregate -- average approval across every tracked official, not an estimate.
  const pulseScore = phase1Reps.length
    ? Math.round(phase1Reps.reduce((sum, r) => sum + r.approval, 0) / phase1Reps.length)
    : null;

  return (
    <StorySection
      eyebrow="Live platform preview"
      headline="See Accountability In Action"
      body={<p>This isn't a mockup — it's what's happening on MandateWatch right now.</p>}
    >
      <div className="hs-preview-grid">
        {topRep && (
          <button className="hs-preview-card" onClick={() => onNavigate("reps")}>
            <div className="hs-preview-card-label"><Users size={14} /> Top approval rating</div>
            <div className="hs-preview-card-title">{topRep.name}</div>
            <div className="hs-preview-card-meta"><MapPin size={11} /> {topRep.constituency}, {topRep.state}</div>
            <div className="hs-preview-card-stat">{topRep.approval}% approval</div>
          </button>
        )}

        <button className="hs-preview-card" onClick={() => onNavigate("pulsemap")}>
          <div className="hs-preview-card-label"><MapPin size={14} /> PulseMap™</div>
          <div className="hs-preview-card-title">Explore governance by state</div>
          <div className="hs-preview-card-meta">Tap any state to see who represents it</div>
          <div className="hs-preview-card-cta">{platform.cta.explorePulseMap} <ArrowRight size={13} /></div>
        </button>

        {latestDemand && (
          <button className="hs-preview-card" onClick={() => onNavigate("demands")}>
            <div className="hs-preview-card-label">Latest demand</div>
            <div className="hs-preview-card-title">{latestDemand.title}</div>
            <div className="hs-preview-card-meta">{latestDemandRep ? latestDemandRep.name : "Representative"} · {latestDemand.upvotes} upvotes</div>
          </button>
        )}

        {trendingThread && (
          <button className="hs-preview-card" onClick={() => onNavigate("discussion")}>
            <div className="hs-preview-card-label"><MessageSquare size={14} /> Trending discussion</div>
            <div className="hs-preview-card-title">{trendingThread.title}</div>
            <div className="hs-preview-card-meta">Started by {trendingThread.author}</div>
          </button>
        )}

        {pulseScore != null && (
          <div className="hs-preview-card hs-preview-card-static">
            <div className="hs-preview-card-label"><TrendingUp size={14} /> Pulse Score</div>
            <div className="hs-preview-card-title">{pulseScore}%</div>
            <div className="hs-preview-card-meta">Average approval across {phase1Reps.length} tracked officials</div>
          </div>
        )}
      </div>
    </StorySection>
  );
}

export default LivePreview;
