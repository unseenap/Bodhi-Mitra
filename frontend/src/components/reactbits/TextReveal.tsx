import type { CSSProperties } from "react";

type TextRevealProps = {
  text: string;
  as?: "h1" | "h2" | "p" | "span";
  className?: string;
  lang?: string;
  delay?: number;
};

// Copy-owned adaptation of the split-text reveal pattern popularized by React Bits.
export function TextReveal({ text, as: Tag = "span", className = "", lang, delay = 0 }: TextRevealProps) {
  const words = text.split(" ");

  return (
    <Tag className={`react-bits-text-reveal ${className}`.trim()} aria-label={text} lang={lang}>
      {words.map((word, index) => (
        <span
          aria-hidden="true"
          className="react-bits-text-reveal__word"
          key={`${word}-${index}`}
          style={{ "--word-delay": `${delay + index * 0.045}s` } as CSSProperties}
        >
          {word}{index < words.length - 1 ? "\u00a0" : ""}
        </span>
      ))}
    </Tag>
  );
}
