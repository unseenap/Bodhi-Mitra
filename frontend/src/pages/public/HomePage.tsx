import {
  ArrowRight,
  ChatCircleDots,
  CheckCircle,
  Clock,
  Heart,
  LockKey,
  Phone,
  ShieldCheck,
  UserCircleCheck,
  Warning,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const taglines = [
  "You are not alone. Support starts here.",
  "A safe space is just one step away.",
  "Talk to a verified psychologist in minutes.",
  "Your mental health matters. Reach out today.",
  "Confidential support, whenever you need it.",
];

const supportSteps = [
  {
    icon: UserCircleCheck,
    title: "Reach out",
    copy: "Choose urgent help or start a private support request.",
    to: "/quick-connect",
  },
  {
    icon: Clock,
    title: "Connect",
    copy: "We alert available, admin-verified university psychologists.",
    to: "/experts",
  },
  {
    icon: Heart,
    title: "Get support",
    copy: "Talk by chat, voice, or video—and leave whenever you need.",
    to: "/privacy",
  },
];

const protections = [
  "Psychologists are qualified and verified by the administrator.",
  "Your student identity stays shielded during the session.",
  "Choose chat, voice, or video based on what feels comfortable.",
  "Safety escalation is available when immediate help is needed.",
  "You stay in control and can end a session at any time.",
];

export function HomePage() {
  const [loading, setLoading] = useState(() => !sessionStorage.getItem("bodhi_intro"));
  const [tagline, setTagline] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem("bodhi_intro", "seen");
      setLoading(false);
    }, 1700);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setTagline((value) => (value + 1) % taglines.length),
      4000,
    );
    return () => window.clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="intro-screen home-intro" role="status" aria-label="Loading Bodhi-Mitra">
        <p className="home-intro__title"><strong>Bodhi-Mitra</strong>, solace to your mind</p>
        <video src="/videos/psy-loop.mp4" autoPlay muted loop playsInline aria-hidden="true" />
        <p>Connecting you to safe, confidential support…</p>
      </div>
    );
  }

  return (
    <div className="home-rebuild">
      <section className="home-rebuild__hero">
        <div className="home-rebuild__hero-inner">
          <p className="home-rebuild__signature">Bodhi-Mitra: Solace to your mind</p>
          <div className="home-rebuild__headline" aria-live="polite">
            <h1 key={tagline}>{taglines[tagline]}</h1>
          </div>
          <p className="home-rebuild__lead">Talk to a verified psychologist—safely, privately, and without judgment.</p>
          <div className="home-rebuild__actions">
            <Link className="home-action home-action--urgent" to="/emergency">
              <Warning weight="fill" /> Emergency help
            </Link>
            <Link className="home-action home-action--talk" to="/quick-connect">
              <ChatCircleDots weight="duotone" /> Talk now <ArrowRight />
            </Link>
          </div>
          <p className="home-rebuild__danger-note">
            <Warning weight="fill" /> If you are in immediate danger, call <a href="tel:112">112</a>.
          </p>
        </div>
      </section>

      <section className="home-rebuild__steps" aria-labelledby="how-it-works">
        <header>
          <h2 id="how-it-works">How Bodhi-Mitra works</h2>
          <p>Clear support, without a complicated process.</p>
        </header>
        <div className="home-rebuild__step-grid">
          {supportSteps.map(({ icon: Icon, title, copy, to }, index) => (
            <Link to={to} key={title} className="home-step">
              <span className="home-step__number">0{index + 1}</span>
              <span className="home-step__icon"><Icon weight="duotone" /></span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <span className="home-step__link">Learn more <ArrowRight /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-rebuild__safety" aria-labelledby="safety-heading">
        <div className="home-rebuild__safety-copy">
          <ShieldCheck weight="duotone" className="home-rebuild__shield" />
          <h2 id="safety-heading">Your safety is our priority</h2>
          <p>Built for GBU students with privacy, professional accountability, and human care at the centre.</p>
          <ul>
            {protections.map((protection) => (
              <li key={protection}><CheckCircle weight="fill" /> <span>{protection}</span></li>
            ))}
          </ul>
          <Link to="/privacy">Read our privacy approach <ArrowRight /></Link>
        </div>
        <div className="home-rebuild__safety-visual">
          <img src="/images/GBUBG2.png" alt="Gautam Buddha University campus" />
          <div className="home-rebuild__verified"><ShieldCheck weight="fill" /><span><strong>Safe & verified</strong>Support designed for GBU</span></div>
        </div>
      </section>

      <section className="home-rebuild__impact" aria-label="Bodhi-Mitra support facts">
        <blockquote>“Seeking help is not weakness. It is a strong first step toward feeling like yourself again.”</blockquote>
        <div className="home-rebuild__stats">
          <div><strong>Verified</strong><span>psychologists</span></div>
          <div><strong>&lt;60s</strong><span>target response</span></div>
          <div><strong>3 ways</strong><span>to connect</span></div>
          <div><strong>Private</strong><span>identity shielding</span></div>
        </div>
      </section>

      <section className="home-rebuild__campus-help">
        <div><LockKey weight="duotone" /><span><strong>Need campus support?</strong>The GBU crisis hotline is available when you need immediate guidance.</span></div>
        <a href="tel:+911212121212"><Phone weight="fill" /> +91 1212121212</a>
      </section>

      <Link className="home-rebuild__mobile-emergency" to="/emergency">
        <Warning weight="fill" /> Emergency help
      </Link>
    </div>
  );
}
