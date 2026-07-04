import { ChevronDown } from "lucide-react";

export function TransitionSection() {
  return (
    <div className="hs-transition">
      <span>Explore the platform</span>
      <ChevronDown size={16} className="hs-transition-arrow" />
    </div>
  );
}

export default TransitionSection;
