import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from "react";

type AnimatedGradientTextProps = ComponentPropsWithoutRef<"span"> & {
  speed?: number;
  colorFrom?: string;
  colorTo?: string;
};

// Copy-owned Magic UI adaptation that works with this project's CSS architecture.
export function AnimatedGradientText({
  children,
  className = "",
  speed = 1,
  colorFrom = "#ffffff",
  colorTo = "#ddd6fe",
  style,
  ...props
}: AnimatedGradientTextProps) {
  return (
    <span
      className={`magic-animated-gradient-text ${className}`.trim()}
      style={{
        "--magic-gradient-size": `${speed * 300}%`,
        "--magic-gradient-from": colorFrom,
        "--magic-gradient-to": colorTo,
        ...style,
      } as CSSProperties}
      {...props}
    >
      {children}
    </span>
  );
}

export function ShineBorder({ duration = 10 }: { duration?: number }) {
  return <span className="magic-shine-border" style={{ "--shine-duration": `${duration}s` } as CSSProperties} aria-hidden="true" />;
}

export function BlurFade({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: .12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`magic-blur-fade ${visible ? "is-visible" : ""} ${className}`} style={{ "--blur-delay": `${delay}s` } as CSSProperties}>{children}</div>;
}

export function NumberTicker({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const started = performance.now();
    const duration = 700;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shown}{suffix}</>;
}
