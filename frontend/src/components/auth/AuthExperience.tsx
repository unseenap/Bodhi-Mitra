import type { ReactNode } from "react";
import { Heart, LockKey, ShieldCheck, Sparkle } from "@phosphor-icons/react";
import { BlurFade, ShineBorder } from "../magicui/ProfileMagic";
import { SpotlightCard } from "../reactbits/SpotlightCard";
import { TextReveal } from "../reactbits/TextReveal";

type AuthExperienceProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  variant?: "login" | "register";
};

export function AuthExperience({ eyebrow, title, description, children, variant = "login" }: AuthExperienceProps) {
  return <section className={`auth-experience auth-experience--${variant}`}>
    <div className="auth-orb auth-orb--one" aria-hidden="true" />
    <div className="auth-orb auth-orb--two" aria-hidden="true" />
    <aside className="auth-story">
      <div className="auth-story__brand">
        <img src="/images/bodhi-logo.svg" alt="" />
        <span><strong>Bodhi-Mitra</strong><small>Gautam Buddha University</small></span>
      </div>
      <BlurFade className="auth-story__copy">
        <span className="auth-kicker"><Sparkle weight="fill" /> A calmer space starts here</span>
        <TextReveal as="h2" text="Support that meets you where you are." delay={.05} />
        <p>Connect with university-approved mental-health professionals in a private, compassionate environment.</p>
      </BlurFade>
      <BlurFade className="auth-story__visual" delay={.12}>
        <SpotlightCard className="auth-story__visual-card">
          <img src="/support-space.webp" alt="A calm, welcoming space for student wellbeing" />
          <div className="auth-story__float"><Heart weight="fill" /><span><strong>You are not alone</strong><small>Care is only a conversation away.</small></span></div>
        </SpotlightCard>
      </BlurFade>
      <div className="auth-story__trust">
        <span><ShieldCheck weight="duotone" /> University verified</span>
        <span><LockKey weight="duotone" /> Privacy protected</span>
      </div>
    </aside>
    <main className="auth-workspace">
      <ShineBorder duration={16} />
      <div className="auth-mobile-brand"><img src="/images/bodhi-logo.svg" alt="" /><strong>Bodhi-Mitra</strong></div>
      <BlurFade className="auth-workspace__header">
        <span>{eyebrow}</span>
        <TextReveal as="h1" text={title} delay={.04} />
        <p>{description}</p>
      </BlurFade>
      <BlurFade className="auth-workspace__content" delay={.08}>{children}</BlurFade>
      <p className="auth-assurance"><LockKey weight="duotone" /> Your information is encrypted and used only to provide support.</p>
    </main>
  </section>;
}

export function maskIdentifier(identifier: string) {
  return identifier.includes("@")
    ? identifier.replace(/^(.{2}).*(@.*)$/, "$1***$2")
    : `${identifier.slice(0, 3)}***${identifier.slice(-2)}`;
}

export function OtpVisual({ identifier, conditional = false }: { identifier: string; conditional?: boolean }) {
  const maskedIdentifier = maskIdentifier(identifier);
  return <div className="otp-visual" aria-hidden="true">
    <div className="otp-envelope"><span /><i>••••••</i></div>
    <div><strong>{conditional ? "Check for your secure code" : "Check your inbox"}</strong><small>{conditional ? `If an active account matches ${maskedIdentifier}, the code will arrive shortly.` : `We sent a secure code to ${maskedIdentifier}`}</small></div>
  </div>;
}
