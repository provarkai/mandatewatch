// Slice 1B — shared section shell every homepage story section composes inside, so heading/body/
// spacing chrome lives in one place instead of being re-implemented per section.

export function StorySection({ eyebrow, headline, body, children, tone, className = "" }) {
  return (
    <section className={`hs-section ${tone ? `hs-section-${tone}` : ""} ${className}`.trim()}>
      <div className="hs-section-inner">
        {eyebrow && <div className="hs-eyebrow">{eyebrow}</div>}
        {headline && <h2 className="hs-headline">{headline}</h2>}
        {body && <div className="hs-body">{body}</div>}
        {children}
      </div>
    </section>
  );
}

export default StorySection;
