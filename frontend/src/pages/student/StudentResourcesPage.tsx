import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Brain, Check, Eye, Hand, Headphones, Pause, Phone, Play, Quotes, ShieldCheck, Sparkle, Timer, WarningCircle, Wind } from "@phosphor-icons/react";
import { BlurFade, NumberTicker, ShineBorder } from "../../components/magicui/ProfileMagic";
import { SpotlightCard } from "../../components/reactbits/SpotlightCard";
import { TextReveal } from "../../components/reactbits/TextReveal";
import { Button } from "../../components/ui/Button";

const breathingPhases = [
  { label: "Breathe in", seconds: 4 },
  { label: "Hold gently", seconds: 4 },
  { label: "Breathe out", seconds: 6 },
  { label: "Rest", seconds: 2 }
] as const;

const groundingSteps = [
  { number: 5, sense: "See", text: "Name five things you can see.", Icon: Eye },
  { number: 4, sense: "Touch", text: "Notice four things you can feel.", Icon: Hand },
  { number: 3, sense: "Hear", text: "Listen for three different sounds.", Icon: Headphones },
  { number: 2, sense: "Smell", text: "Find two scents around you.", Icon: Wind },
  { number: 1, sense: "Taste", text: "Notice one taste in this moment.", Icon: Sparkle }
] as const;

const affirmations = [
  "I am worthy of care and support.",
  "This feeling is temporary. I can move through it.",
  "I do not have to solve everything at once.",
  "It is okay to ask for help.",
  "A small step still counts as progress."
] as const;

const helplines = [
  { name: "GBU Counselling Centre", number: "+91 1212121212", href: "+911212121212", tag: "Campus" },
  { name: "Emergency services", number: "112", href: "112", tag: "Immediate danger" },
  { name: "Tele-MANAS", number: "14416", href: "14416", tag: "National" },
  { name: "Vandrevala Foundation", number: "9999666555", href: "9999666555", tag: "General" },
  { name: "iCALL", number: "9152987821", href: "9152987821", tag: "Student support" },
  { name: "NIMHANS", number: "08046804680", href: "08046804680", tag: "Government" }
] as const;

export function StudentResources() {
  const [breathing, setBreathing] = useState(false);
  const [phase, setPhase] = useState(0);
  const [remaining, setRemaining] = useState<number>(breathingPhases[0].seconds);
  const [cycles, setCycles] = useState(0);
  const [groundingDone, setGroundingDone] = useState<number[]>([]);
  const [affirmation, setAffirmation] = useState(0);

  useEffect(() => {
    if (!breathing) return;
    const timer = window.setTimeout(() => {
      if (remaining > 1) {
        setRemaining(value => value - 1);
        return;
      }
      const next = (phase + 1) % breathingPhases.length;
      setPhase(next);
      setRemaining(breathingPhases[next].seconds);
      if (next === 0) setCycles(value => value + 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [breathing, phase, remaining]);

  const phaseDuration = breathingPhases[phase].seconds;
  const progress = breathing ? ((phaseDuration - remaining + 1) / phaseDuration) * 360 : 0;

  function startBreathing() {
    setPhase(0);
    setRemaining(breathingPhases[0].seconds);
    setCycles(0);
    setBreathing(true);
  }

  function toggleGrounding(number: number) {
    setGroundingDone(current => current.includes(number) ? current.filter(value => value !== number) : [...current, number]);
  }

  return (
    <section className="student-page wellbeing-page">
      <BlurFade className="wellbeing-hero">
        <ShineBorder duration={14} />
        <div className="wellbeing-hero__copy">
          <span><Sparkle weight="fill" /> Your private wellbeing toolkit</span>
          <TextReveal as="h1" text="A quieter moment starts here." delay={0.05} />
          <p>Use a short guided exercise, return to the present, or reach direct support. Choose only what feels helpful right now.</p>
          <nav>
            <a href="#breathing">Start breathing <ArrowRight /></a>
            <a href="#helplines">View helplines</a>
          </nav>
        </div>
        <div className="wellbeing-hero__visual" aria-hidden="true">
          <span><Brain weight="duotone" /></span>
          <div><i /><i /><i /><i /><i /></div>
          <small>Pause</small>
        </div>
      </BlurFade>

      <BlurFade className="wellbeing-note" delay={0.08}>
        <ShieldCheck weight="duotone" />
        <p><strong>Use these tools at your own pace.</strong> Your activity on this page is not saved to your profile.</p>
      </BlurFade>

      <div className="wellbeing-grid">
        <BlurFade className="wellbeing-grid__breathing" delay={0.12}>
          <SpotlightCard className="wellbeing-card breathing-studio">
            <ShineBorder duration={12} />
            <header id="breathing">
              <span><Wind weight="duotone" /></span>
              <div><small>Guided reset</small><h2>4-4-6-2 breathing</h2></div>
              <b><Timer /> {cycles ? <><NumberTicker value={cycles} /> {cycles === 1 ? "cycle" : "cycles"}</> : "2 minutes"}</b>
            </header>
            <div className={`breathing-stage breathing-stage--${breathing ? "active" : "idle"}`}>
              <div className="breathing-orbit" style={{ "--breathing-progress": `${progress}deg` } as CSSProperties}>
                <span><Wind weight="duotone" /></span>
              </div>
              <div className="breathing-instruction" aria-live="polite">
                <small>{breathing ? `Step ${phase + 1} of 4` : "Ready when you are"}</small>
                <strong>{breathing ? breathingPhases[phase].label : "Find a comfortable position"}</strong>
                <b>{breathing ? remaining : "4 · 4 · 6 · 2"}</b>
                <p>{breathing ? "Let the circle guide your pace. There is no need to force the breath." : "A slower exhale can help your body settle after a stressful moment."}</p>
              </div>
            </div>
            <footer>
              {breathing ? <Button variant="secondary" onClick={() => setBreathing(false)}><Pause weight="fill" /> Pause exercise</Button> : <Button onClick={startBreathing}><Play weight="fill" /> Begin guided breathing</Button>}
              {breathing && <button onClick={startBreathing}>Restart</button>}
            </footer>
          </SpotlightCard>
        </BlurFade>

        <BlurFade className="wellbeing-grid__grounding" delay={0.16}>
          <SpotlightCard className="wellbeing-card grounding-studio">
            <header><span><Brain weight="duotone" /></span><div><small>Come back to now</small><h2>5-4-3-2-1 grounding</h2></div></header>
            <p>Move through each sense. Tap a step when you have noticed something.</p>
            <div className="grounding-steps">
              {groundingSteps.map(({ number, sense, text, Icon }) => {
                const done = groundingDone.includes(number);
                return <button className={done ? "is-done" : ""} onClick={() => toggleGrounding(number)} aria-pressed={done} key={number}>
                  <b>{done ? <Check weight="bold" /> : number}</b><Icon /><span><strong>{sense}</strong><small>{text}</small></span>
                </button>;
              })}
            </div>
            <footer><span><NumberTicker value={groundingDone.length} /> of 5 complete</span>{groundingDone.length > 0 && <button onClick={() => setGroundingDone([])}>Reset</button>}</footer>
          </SpotlightCard>
        </BlurFade>

        <BlurFade className="wellbeing-grid__affirmation" delay={0.2}>
          <SpotlightCard className="wellbeing-card affirmation-studio">
            <Quotes weight="fill" />
            <small>A thought to carry</small>
            <TextReveal as="h2" text={affirmations[affirmation]} delay={0.04} />
            <button onClick={() => setAffirmation(value => (value + 1) % affirmations.length)}>Show another <ArrowRight /></button>
          </SpotlightCard>
        </BlurFade>

        <BlurFade className="wellbeing-grid__help" delay={0.24}>
          <SpotlightCard className="wellbeing-card support-prompt">
            <WarningCircle weight="duotone" />
            <div><small>Need a person instead?</small><h2>You do not have to manage this alone.</h2><p>A university-approved psychologist can join you in a private support session.</p></div>
            <Link to="/student">Connect now <ArrowRight /></Link>
          </SpotlightCard>
        </BlurFade>
      </div>

      <BlurFade className="helpline-directory" delay={0.28}>
        <header id="helplines"><div><span><Phone weight="fill" /> Direct support</span><h2>Call when you need a human voice</h2><p>If you may be in immediate danger, call 112 or ask someone nearby to stay with you.</p></div><b>Tap any number to call</b></header>
        <div>
          {helplines.map((line, index) => <a href={`tel:${line.href}`} key={line.name}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><small>{line.tag}</small><strong>{line.name}</strong></div>
            <b>{line.number}</b><Phone weight="fill" />
          </a>)}
        </div>
      </BlurFade>

      <p className="wellbeing-disclaimer">These resources support wellbeing and do not provide a diagnosis or replace professional or emergency care.</p>
    </section>
  );
}
