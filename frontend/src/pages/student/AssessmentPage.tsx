import { ArrowLeft, ArrowRight, CalendarBlank, Check, ChatTeardropText, Clock, Heartbeat, LockKey, Phone, ShieldCheck, Sparkle, Translate, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BlurFade, NumberTicker, ShineBorder } from "../../components/magicui/ProfileMagic";
import { TextReveal } from "../../components/reactbits/TextReveal";
import { SpotlightCard } from "../../components/reactbits/SpotlightCard";
import { Button } from "../../components/ui/Button";
import { api } from "../../lib/api";
import { assessmentCopy, pwqQuestions, type AssessmentLanguage } from "../../data/pwq";

type Result = { _id?: string; score: number; band: "low" | "moderate" | "high" | "urgent"; safetyFlag: boolean; completedAt: string; monthKey: string };
type Status = { eligible: boolean; nextEligibleAt: string | null; latest: Result | null; history: Result[] };
const results = {
  low: { title: "Few concerns reported", body: "Your responses suggest relatively few current concerns. Keep checking in with yourself and use support whenever you need it." },
  moderate: { title: "Some concerns deserve attention", body: "A few areas may be affecting your wellbeing. Consider using the student resources or speaking with someone you trust." },
  high: { title: "A conversation may help", body: "Your responses suggest meaningful distress. We recommend connecting with a Bodhi-Mitra psychologist soon." },
  urgent: { title: "Please connect with support today", body: "Your responses indicate significant distress. You deserve prompt, compassionate support from a trained professional." }
};

export function AssessmentPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [language, setLanguage] = useState<AssessmentLanguage>("en");
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(boolean | null)[]>(Array(20).fill(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => { api<Status>("/student/assessment").then(setStatus).catch(cause => setError(cause.message)); }, []);
  const answer = answers[index];
  const copy = assessmentCopy[language];
  const safetySelected = answers[14] === true;

  function choose(value: boolean) {
    setAnswers(current => { const next = [...current]; next[index] = value; return next; });
  }

  async function next() {
    if (answer === null) return;
    if (index < 19) { setIndex(value => value + 1); return; }
    setBusy(true);
    setError("");
    try {
      const response = await api<{ result: Result; nextEligibleAt: string }>("/student/assessment", { method: "POST", body: JSON.stringify({ answers }) });
      setResult(response.result);
      setStatus(current => current ? { ...current, eligible: false, nextEligibleAt: response.nextEligibleAt, latest: response.result, history: [response.result, ...current.history] } : current);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  if (error && !status) return <section className="assessment-page"><div className="assessment-state assessment-state--error"><WarningCircle /><h1>Assessment unavailable</h1><p>{error}</p></div></section>;
  if (!status) return <section className="assessment-page"><div className="assessment-skeleton"><i /><i /><i /></div></section>;

  const shown = result ?? (!status.eligible ? status.latest : null);
  if (shown) {
    const content = results[shown.band];
    return <section className="assessment-page"><BlurFade className={`assessment-result assessment-result--${shown.band}`}><ShineBorder duration={12} /><header><span><Heartbeat weight="duotone" /></span><small>PWQ wellbeing check-in</small><TextReveal as="h1" text={content.title} delay={0.08} /><p>{content.body}</p></header><div className="assessment-score"><strong><NumberTicker value={shown.score} /></strong><span>out of 20 concerns reported</span></div><div className="assessment-result-actions">{shown.band === "urgent" || shown.band === "high" ? <Link className="button button--primary" to="/student"><Heartbeat /> Connect with a psychologist</Link> : <Link className="button button--primary" to="/student/resources">Explore wellbeing resources</Link>}<Link className="button button--secondary" to="/student/profile">View profile</Link></div>{shown.safetyFlag && <div className="assessment-safety"><WarningCircle weight="fill" /><div><strong>Your safety matters right now</strong><p>If you may act on thoughts of self-harm, call emergency services or the campus crisis line and stay with someone you trust.</p><a href="tel:+911212121212"><Phone weight="fill" /> Call +91 1212121212</a></div></div>}<footer><CalendarBlank /> Next weekly check-in: {status.nextEligibleAt ? new Date(status.nextEligibleAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "in 7 days"}</footer></BlurFade></section>;
  }

  if (!started) return (
    <section className="assessment-page assessment-page--intro">
      <BlurFade className="assessment-intro">
        <ShineBorder duration={12} />
        <div className="assessment-intro__top">
          <span><Sparkle weight="fill" /> PRIVATE WEEKLY REFLECTION</span>
          <small><ShieldCheck weight="fill" /> Secure student space</small>
        </div>

        <div className="assessment-intro__layout">
          <div className="assessment-intro__copy">
            <div className="assessment-intro__mark"><Heartbeat weight="duotone" /></div>
            <TextReveal as="h1" text="Take a quiet moment to check in." delay={0.06} />
            <p>Reflect on the past 14 days through 20 simple Yes or No questions. Your result supports self-awareness and is never presented as a diagnosis.</p>
            <div className="assessment-intro__assurance">
              <ShieldCheck weight="duotone" />
              <span><strong>Your answers stay connected to your private account</strong><small>Only authorized wellbeing staff can review support-level results.</small></span>
            </div>
          </div>

          <SpotlightCard className="assessment-preview">
            <span>WHAT TO EXPECT</span>
            <ol>
              <li><i><Clock /></i><div><strong>About 3 minutes</strong><small>One clear question at a time</small></div></li>
              <li><i><Translate /></i><div><strong>English or Hindi</strong><small>Switch language at any point</small></div></li>
              <li><i><ChatTeardropText /></i><div><strong>Personal guidance</strong><small>Receive a support-focused summary</small></div></li>
            </ol>
            <p><CalendarBlank /> Available once every 7 days</p>
          </SpotlightCard>
        </div>

        <div className="assessment-intro__actions">
          <div className="assessment-language">
            <Translate />
            <span><strong>Assessment language</strong><small>You can switch during the check-in</small></span>
            <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button>
            <button className={language === "hi" ? "active" : ""} onClick={() => setLanguage("hi")}>हिन्दी</button>
          </div>
          <Button onClick={() => setStarted(true)}>Begin private check-in <ArrowRight /></Button>
        </div>
      </BlurFade>
    </section>
  );

  const progress = (index + 1) / 20 * 100;
  return <section className="assessment-page assessment-page--active"><div className="assessment-shell"><ShineBorder duration={16} /><header><div><Heartbeat /><span><strong>PWQ check-in</strong><small>Past 14 days or more</small></span></div><div className="assessment-language assessment-language--compact"><Translate /><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button><button className={language === "hi" ? "active" : ""} onClick={() => setLanguage("hi")}>हिं</button></div></header><div className="assessment-progress"><span style={{ width: `${progress}%` }} /><small>{copy.question} {index + 1} / 20</small></div>{safetySelected && <div className="assessment-live-safety"><WarningCircle weight="fill" /><span><strong>You do not have to handle this alone.</strong>If you feel in immediate danger, call <a href="tel:+911212121212">+91 1212121212</a> now.</span></div>}<main key={`${index}-${language}`}><span>{String(index + 1).padStart(2, "0")}</span><TextReveal as="h1" lang={language === "hi" ? "hi" : "en"} text={pwqQuestions[index][language]} /><p>{language === "hi" ? "पिछले 14 दिनों या उससे अधिक समय के बारे में सोचें।" : "Think about the past 14 days or more."}</p><div className="assessment-options"><button className={answer === true ? "selected yes" : ""} onClick={() => choose(true)}><i>{answer === true ? <Check weight="bold" /> : null}</i><span><strong>{copy.yes}</strong><small>{language === "hi" ? "मैंने इसका अनुभव किया है" : "I have experienced this"}</small></span></button><button className={answer === false ? "selected no" : ""} onClick={() => choose(false)}><i>{answer === false ? <Check weight="bold" /> : null}</i><span><strong>{copy.no}</strong><small>{language === "hi" ? "मैंने इसका अनुभव नहीं किया है" : "I have not experienced this"}</small></span></button></div></main>{error && <div className="assessment-submit-error" role="alert"><WarningCircle />{error}</div>}<footer><button disabled={index === 0 || busy} onClick={() => setIndex(value => value - 1)}><ArrowLeft /> {copy.back}</button><Button disabled={answer === null || busy} onClick={() => void next()}>{busy ? "Saving…" : index === 19 ? copy.finish : copy.continue}<ArrowRight /></Button></footer></div></section>;
}
