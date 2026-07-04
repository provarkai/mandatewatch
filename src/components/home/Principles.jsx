import { CheckCircle2 } from "lucide-react";
import { StorySection } from "./StorySection";
import { usePlatform } from "../../platform/usePlatform";

// Renders platform.brand.values directly -- defined in Slice 1A with no call site until now.
export function Principles() {
  const platform = usePlatform();
  return (
    <StorySection eyebrow="Principles" headline="What MandateWatch Stands For">
      <div className="hs-principles-list">
        {platform.brand.values.map((value) => (
          <div className="hs-principle" key={value}>
            <CheckCircle2 size={16} />
            <span>{value}</span>
          </div>
        ))}
      </div>
    </StorySection>
  );
}

export default Principles;
