import type { ReactNode } from "react";
import { Heart, LockKey, ShieldCheck, Sparkle } from "@phosphor-icons/react";

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
      <div className="auth-story__copy">
        <span className="auth-kicker"><Sparkle weight="fill" /> A calmer space starts here</span>
        <h2>Support that meets you <em>where you are.</em></h2>
        <p>Connect with university-approved mental-health professionals in a private, compassionate environment.</p>
      </div>
      <div className="auth-story__visual">
        <img src="/support-space.webp" alt="A calm, welcoming space for student wellbeing" />
        <div className="auth-story__float"><Heart weight="fill" /><span><strong>You are not alone</strong><small>Care is only a conversation away.</small></span></div>
      </div>
      <div className="auth-story__trust">
        <span><ShieldCheck weight="duotone" /> University verified</span>
        <span><LockKey weight="duotone" /> Privacy protected</span>
      </div>
    </aside>
    <div className="auth-workspace">
      <div className="auth-mobile-brand"><img src="/images/bodhi-logo.svg" alt="" /><strong>Bodhi-Mitra</strong></div>
      <header className="auth-workspace__header">
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      {children}
      <p className="auth-assurance"><LockKey weight="duotone" /> Your information is encrypted and used only to provide support.</p>
    </div>
  </section>;
}

export function OtpVisual({ identifier }: { identifier: string }) {
  return <div className="otp-visual" aria-hidden="true">
    <div className="otp-envelope"><span /><i>••••••</i></div>
    <div><strong>Check your inbox</strong><small>We sent a secure code to {identifier}</small></div>
  </div>;
}
