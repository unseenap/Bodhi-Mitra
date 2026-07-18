import type { CSSProperties, PointerEvent, ReactNode } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
};

// Copy-owned adaptation of the pointer spotlight interaction popularized by React Bits.
export function SpotlightCard({ children, className = "" }: SpotlightCardProps) {
  function moveSpotlight(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
  }

  return (
    <div className={`react-bits-spotlight ${className}`.trim()} onPointerMove={moveSpotlight}>
      <span className="react-bits-spotlight__glow" aria-hidden="true" />
      <div className="react-bits-spotlight__content">{children}</div>
    </div>
  );
}
