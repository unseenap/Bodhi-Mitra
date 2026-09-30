import { useEffect, useRef, type CSSProperties } from "react";
import "./ParticleText.css";

type Trigger = "mount" | "hover" | "click";

interface ParticleTextProps {
  text?: string;
  particleSize?: number;
  density?: number;
  color?: string;
  highlightColor?: string;
  scatter?: number;
  gatherDuration?: number;
  stagger?: number;
  pointerRepel?: number;
  repelRadius?: number;
  idleDrift?: number;
  trigger?: Trigger;
  fontSize?: number | string;
  fontWeight?: number | string;
  fontFamily?: string;
  glow?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface Particle {
  x: number; y: number; startX: number; startY: number; targetX: number; targetY: number;
  size: number; color: string; seed: number; depth: number; delay: number;
}

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
};
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);
const mixRgb = (from: { r: number; g: number; b: number }, to: { r: number; g: number; b: number }, amount: number) =>
  `rgb(${Math.round(from.r + (to.r - from.r) * amount)}, ${Math.round(from.g + (to.g - from.g) * amount)}, ${Math.round(from.b + (to.b - from.b) * amount)})`;

export default function ParticleText({
  text = "React Bits", particleSize = 2, density = 4, color = "#ffffff", highlightColor = "#8b5cf6",
  scatter = 180, gatherDuration = 1600, stagger = 420, pointerRepel = 40, repelRadius = 120,
  idleDrift = 0.7, trigger = "mount", fontSize = "clamp(3rem, 12vw, 8rem)", fontWeight = 800,
  fontFamily = "inherit", glow = true, className = "", style
}: ParticleTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!container || !canvas || !ctx) return;

    let particles: Particle[] = [];
    let animationFrame: number | null = null;
    let resizeFrame: number | null = null;
    let buildId = 0;
    let gathering = false;
    let gatherStart = 0;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    const pointer = { active: false, x: 0, y: 0, smoothX: 0, smoothY: 0 };

    const startGather = (fromScatter = true) => {
      if (!particles.length) return;
      const spread = reducedMotion ? 0 : scatter;
      particles.forEach((particle) => {
        if (fromScatter) {
          const angle = particle.seed * Math.PI * 2;
          const distance = spread * (0.35 + particle.depth * 0.75);
          particle.x = particle.targetX + Math.cos(angle) * distance + (particle.depth - 0.5) * spread * 0.55;
          particle.y = particle.targetY + Math.sin(angle) * distance + (particle.seed - 0.5) * spread * 0.55;
        }
        particle.startX = particle.x;
        particle.startY = particle.y;
        particle.delay = reducedMotion ? 0 : particle.seed * stagger;
      });
      gatherStart = performance.now();
      gathering = true;
    };

    const render = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.shadowBlur = glow && !reducedMotion ? particleSize * 3 : 0;
      ctx.shadowColor = highlightColor;
      pointer.smoothX += (pointer.x - pointer.smoothX) * 0.18;
      pointer.smoothY += (pointer.y - pointer.smoothY) * 0.18;
      let complete = true;

      particles.forEach((particle) => {
        let baseX = particle.targetX;
        let baseY = particle.targetY;
        let progress = 1;
        if (gathering) {
          progress = clamp((now - gatherStart - particle.delay) / Math.max(1, reducedMotion ? 1 : gatherDuration), 0, 1);
          const eased = easeOutCubic(progress);
          baseX = particle.startX + (particle.targetX - particle.startX) * eased;
          baseY = particle.startY + (particle.targetY - particle.startY) * eased;
          if (progress < 1) complete = false;
        } else if (!reducedMotion && idleDrift > 0) {
          const time = now * 0.001;
          baseX += Math.sin(time * 0.9 + particle.seed * 10) * idleDrift * particle.depth;
          baseY += Math.cos(time * 0.75 + particle.depth * 10) * idleDrift * particle.depth;
        }
        if (pointer.active && !reducedMotion && pointerRepel > 0 && repelRadius > 0) {
          const dx = baseX - pointer.smoothX;
          const dy = baseY - pointer.smoothY;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < repelRadius) {
            const force = Math.pow(1 - distance / repelRadius, 2) * pointerRepel;
            baseX += (dx / distance) * force;
            baseY += (dy / distance) * force;
          }
        }
        const follow = reducedMotion ? 1 : 0.22;
        particle.x += (baseX - particle.x) * follow;
        particle.y += (baseY - particle.y) * follow;
        ctx.globalAlpha = clamp(0.35 + progress * 0.65, 0, 1);
        ctx.fillStyle = particle.color;
        if (particle.size <= 2.1) ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
        else { ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2); ctx.fill(); }
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      if (gathering && complete) gathering = false;
      animationFrame = window.requestAnimationFrame(render);
    };

    const sampleText = async () => {
      const currentBuild = ++buildId;
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      if (width <= 0 || height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const family = fontFamily === "inherit" ? getComputedStyle(container).fontFamily || "sans-serif" : fontFamily;
      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;font-size:${fontSize};font-weight:${fontWeight};font-family:${family}`;
      probe.textContent = "M";
      container.appendChild(probe);
      let resolvedSize = typeof fontSize === "number" ? fontSize : parseFloat(getComputedStyle(probe).fontSize) || 96;
      probe.remove();
      let font = `${fontWeight} ${resolvedSize}px ${family}`;
      try { await document.fonts?.load(font); await document.fonts?.ready; } catch { /* use the available fallback font */ }
      if (currentBuild !== buildId) return;

      const offscreen = document.createElement("canvas");
      const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
      if (!offCtx) return;
      offCtx.font = font;
      let metrics = offCtx.measureText(text || " ");
      const maxTextWidth = width * 0.9;
      if (metrics.width > maxTextWidth) {
        resolvedSize = Math.max(18, resolvedSize * (maxTextWidth / metrics.width));
        font = `${fontWeight} ${resolvedSize}px ${family}`;
        offCtx.font = font;
        metrics = offCtx.measureText(text || " ");
      }
      const left = Math.ceil(metrics.actualBoundingBoxLeft || 0);
      const right = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
      const ascent = Math.ceil(metrics.actualBoundingBoxAscent || resolvedSize * 0.78);
      const descent = Math.ceil(metrics.actualBoundingBoxDescent || resolvedSize * 0.22);
      const padding = Math.max(12, Math.ceil(resolvedSize * 0.08));
      offscreen.width = Math.max(1, left + right) + padding * 2;
      offscreen.height = Math.max(1, ascent + descent) + padding * 2;
      offCtx.font = font;
      offCtx.fillStyle = "#fff";
      offCtx.textBaseline = "alphabetic";
      offCtx.fillText(text || " ", padding - left, padding + ascent);
      const data = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const targets: Array<{ x: number; y: number; alpha: number }> = [];
      const step = Math.max(2, Math.floor(density));
      for (let y = 0; y < offscreen.height; y += step) for (let x = 0; x < offscreen.width; x += step) {
        const alpha = data.data[(y * offscreen.width + x) * 4 + 3];
        if (alpha > 40) targets.push({ x: width / 2 - offscreen.width / 2 + x, y: height / 2 - offscreen.height / 2 + y, alpha: alpha / 255 });
      }
      const stride = Math.max(1, Math.ceil(targets.length / Math.max(900, Math.min(5200, Math.floor((width * height) / 90)))));
      const baseRgb = hexToRgb(color);
      const highlightRgb = hexToRgb(highlightColor);
      particles = targets.filter((_, index) => index % stride === 0).map((target, index) => {
        const seed = ((index * 9301 + 49297) % 233280) / 233280;
        const depth = 0.45 + (((index * 233 + 97) % 1000) / 1000) * 0.9;
        const blend = clamp(target.x / Math.max(1, width) + (seed - 0.5) * 0.35, 0, 1);
        const angle = seed * Math.PI * 2;
        const distance = (reducedMotion ? 0 : scatter) * (0.35 + depth * 0.75);
        const targetColor = baseRgb && highlightRgb ? mixRgb(baseRgb, highlightRgb, blend) : color;
        const x = target.x + Math.cos(angle) * distance + (seed - 0.5) * scatter * 0.45;
        const y = target.y + Math.sin(angle) * distance + (depth - 0.9) * scatter * 0.45;
        return { x: reducedMotion ? target.x : x, y: reducedMotion ? target.y : y, startX: x, startY: y, targetX: target.x, targetY: target.y, size: Math.max(0.6, particleSize * (0.75 + target.alpha * 0.45)), color: targetColor, seed, depth, delay: seed * stagger };
      });
      pointer.x = pointer.smoothX = width / 2;
      pointer.y = pointer.smoothY = height / 2;
      if (reducedMotion) gathering = false; else startGather(false);
      if (animationFrame === null) animationFrame = requestAnimationFrame(render);
    };

    const queueSample = () => { if (resizeFrame !== null) cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(sampleText); };
    const move = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; pointer.active = true; };
    const enter = (event: PointerEvent) => { move(event); if (trigger === "hover") startGather(true); };
    const leave = () => { pointer.active = false; };
    const click = () => { if (trigger === "click") startGather(true); };
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChange = (event: MediaQueryListEvent) => { reducedMotion = event.matches; void sampleText(); };
    const observer = new ResizeObserver(queueSample);
    observer.observe(container);
    canvas.addEventListener("pointerenter", enter);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("click", click);
    motionQuery.addEventListener("change", motionChange);
    void sampleText();

    return () => {
      buildId += 1;
      observer.disconnect();
      motionQuery.removeEventListener("change", motionChange);
      canvas.removeEventListener("pointerenter", enter);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("click", click);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    };
  }, [text, particleSize, density, color, highlightColor, scatter, gatherDuration, stagger, pointerRepel, repelRadius, idleDrift, trigger, fontSize, fontWeight, fontFamily, glow]);

  return <div ref={containerRef} className={`particle-text ${className}`} style={style} aria-label={text}>
    <canvas ref={canvasRef} className="particle-text__canvas" aria-hidden="true" />
    <span className="particle-text__sr">{text}</span>
  </div>;
}
