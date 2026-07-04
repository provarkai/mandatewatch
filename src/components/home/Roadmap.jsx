import { ArrowRight } from "lucide-react";
import { StorySection } from "./StorySection";
import { usePlatform } from "../../platform/usePlatform";

// Renders platform.products where status === "unreleased" -- the Product Module IS the roadmap
// source of truth, so there's no separate roadmap data structure to keep in sync.
export function Roadmap() {
  const platform = usePlatform();
  const upcoming = platform.products.filter((p) => p.status === "unreleased");

  return (
    <StorySection
      eyebrow="Roadmap"
      headline="What's Next"
      body={<p>Genuinely planned, not yet built — no dates promised, just direction.</p>}
    >
      <div className="hs-roadmap-list">
        {upcoming.map((p) => (
          <div className="hs-roadmap-item" key={p.key}>
            <ArrowRight size={14} />
            <span>{p.label}</span>
          </div>
        ))}
      </div>
    </StorySection>
  );
}

export default Roadmap;
