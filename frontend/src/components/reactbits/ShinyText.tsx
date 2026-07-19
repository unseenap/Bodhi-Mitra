import type { CSSProperties } from "react";

type ShinyTextProps = {
  text: string;
  className?: string;
  disabled?: boolean;
  speed?: number;
};

// Copy-owned CSS adaptation of React Bits ShinyText with no runtime animation dependency.
export function ShinyText({ text, className = "", disabled = false, speed = 6 }: ShinyTextProps) {
  return (
    <span
      className={`react-bits-shiny-text${disabled ? " is-disabled" : ""} ${className}`.trim()}
      style={{ "--shiny-text-speed": `${speed}s` } as CSSProperties}
    >
      {text}
    </span>
  );
}
