import { ArrowRight, Brain, ChatCircleDots, ChatTeardropText, Check, CheckCircle, CloudRain, Fire, Heartbeat, LockKey, Microphone, Phone, Question, ShieldCheck, Sparkle, VideoCamera, WarningCircle, Waveform, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SOCKET_EVENTS, type Hotline, type PendingEmergency, type SessionMatch, type SessionMode } from "@bodhi/shared";
import { BlurFade, ShineBorder } from "../magicui/ProfileMagic";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";

type FlowState = "idle" | "preferences" | "submitting" | "queued" | "allocated" | "timeout";
type ActiveRequest = PendingEmergency & { status: "pending" | "matched"; timeoutAt?: string; session?: SessionMatch | null };

const modes = [
  { value: "chat" as const, icon: ChatCircleDots, label: "Chat", description: "Write at your own pace" },
  { value: "voice" as const, icon: Microphone, label: "Voice", description: "Talk without a camera" },
  { value: "video" as const, icon: VideoCamera, label: "Video", description: "Meet face to face" },
];

const moods = [
  { label: "Anxious", icon: Brain }, { label: "Depressed", icon: CloudRain },
  { label: "Overwhelmed", icon: Waveform }, { label: "Angry", icon: Fire },
  { label: "Confused", icon: Question }, { label: "Just need to talk", icon: ChatTeardropText },
];

function elapsedLabel(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function StudentSupportFlow() {
  const navigate = useNavigate();
  const [state, setState] = useState<FlowState>("idle");
  const [mode, setMode] = useState<SessionMode>("chat");
  const [mood, setMood] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [request, setRequest] = useState<PendingEmergency | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [hotlines, setHotlines] = useState<Hotline[]>([]);
  const [error, setError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const startedAt = useRef(Date.now());
  const allocationTimer = useRef<number | null>(null);
  const dialogClose = useRef<HTMLButtonElement>(null);

  useEffect(() => () => { if (allocationTimer.current !== null) window.clearTimeout(allocationTimer.current); }, []);

  useEffect(() => {
    let active = true;
    api<{ active: ActiveRequest | null }>("/student/emergency/active")
      .then(result => {
        if (!active || !result.active) return;
        const current = result.active;
        if (current.status === "matched" && current.session) {
          setState("allocated");
          allocationTimer.current = window.setTimeout(() => navigate(`/student/session/${current.session!.sessionId}`, { state: current.session, replace: true }), 1400);
          return;
        }
        setMode(current.mode); setMood(current.mood ?? ""); setUrgent(Boolean(current.urgent)); setRequest(current);
        startedAt.current = new Date(current.waitStartedAt).getTime();
        setElapsed(Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000)));
        setState("queued");
      })
      .catch(() => setError("We could not check your current request. You can still start a new support request."));
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
    const socket = getSocket();
    const queued = (value: PendingEmergency) => {
      setRequest(value); setMode(value.mode); setMood(value.mood ?? ""); setUrgent(Boolean(value.urgent));
      startedAt.current = Date.now(); setElapsed(0); setError(""); setState("queued");
    };
    const matched = (match: SessionMatch) => {
      setState("allocated");
      allocationTimer.current = window.setTimeout(() => navigate(`/student/session/${match.sessionId}`, { state: match }), 1400);
    };
    const timedOut = (payload: { hotlines: Hotline[] }) => { setHotlines(payload.hotlines); setState("timeout"); setRequest(null); };
    const connectionError = () => setError("The live matching connection was interrupted. We will keep trying while you remain signed in.");
    const connected = () => setError("");
    socket.on(SOCKET_EVENTS.EMERGENCY_QUEUED, queued); socket.on(SOCKET_EVENTS.SESSION_MATCHED, matched); socket.on(SOCKET_EVENTS.EMERGENCY_TIMEOUT, timedOut); socket.on("connect_error", connectionError); socket.on("connect", connected);
    return () => { socket.off(SOCKET_EVENTS.EMERGENCY_QUEUED, queued); socket.off(SOCKET_EVENTS.SESSION_MATCHED, matched); socket.off(SOCKET_EVENTS.EMERGENCY_TIMEOUT, timedOut); socket.off("connect_error", connectionError); socket.off("connect", connected); };
  }, [navigate]);

  useEffect(() => {
    if (state !== "queued") return;
    const timer = window.setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (state !== "preferences") return;
    dialogClose.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setState("idle");
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [state]);

  function submitRequest() {
    if (!mood || state === "submitting") return;
    setState("submitting"); setError("");
    getSocket().timeout(10_000).emit(SOCKET_EVENTS.EMERGENCY_REQUEST, { mode, mood, urgent }, (timeoutError: Error | null, result?: { ok: boolean; message?: string }) => {
      if (!timeoutError && result?.ok) return;
      setState("preferences"); setError(result?.message ?? "We could not confirm your request. Check your connection and try again.");
    });
  }

  function cancelRequest() {
    if (!request) return;
    setError("");
    getSocket().timeout(8_000).emit(SOCKET_EVENTS.EMERGENCY_CANCEL, { requestId: request.requestId }, (timeoutError: Error | null, result?: { ok: boolean; message?: string }) => {
      if (timeoutError || !result?.ok) { setError(result?.message ?? "We could not cancel the request. It may already be accepted."); setCancelOpen(false); return; }
      setCancelOpen(false); setRequest(null); setElapsed(0); setState("idle");
    });
  }

  if (state === "queued") {
    const activeStep = elapsed < 3 ? 1 : elapsed < 8 ? 2 : 3;
    return <BlurFade className="support-match-card" aria-live="polite"><ShineBorder duration={10} />
      <header className="support-match-card__head"><div><span className="support-live-dot" /><strong>Matching in progress</strong></div><time>{elapsedLabel(elapsed)}</time></header>
      <div className="support-match-card__body"><div className="support-match-visual" aria-hidden="true"><span><ShieldCheck weight="duotone" /></span><i /><i /><i /><div><Heartbeat weight="duotone" /></div></div><div className="support-match-card__copy"><small>Request {request?.anonId ?? "protected"}</small><h2>{activeStep < 3 ? "Finding the right psychologist" : "Waiting for a psychologist to accept"}</h2><p>Verified professionals have been notified. Your identity remains protected throughout matching.</p></div></div>
      <ol className="support-progress" aria-label="Matching progress">{["Request protected", "Professionals notified", "Psychologist review", "Connection ready"].map((label, index) => <li key={label} className={index < activeStep ? "complete" : index === activeStep ? "active" : ""}><span>{index < activeStep ? <Check weight="bold" /> : index + 1}</span><small>{label}</small></li>)}</ol>
      <div className="support-match-meta"><span><LockKey /> {modes.find(item => item.value === mode)?.label}</span>{mood && <span><Sparkle /> {mood}</span>}{urgent && <span className="urgent"><WarningCircle /> Priority request</span>}</div>
      {error && <div className="support-flow-error" role="alert"><WarningCircle /> {error}</div>}
      <footer><p>You can stay here while we connect you. If your situation becomes urgent, use emergency help.</p><div><button type="button" onClick={() => setCancelOpen(true)}>Cancel request</button><Link to="/emergency">Emergency help <ArrowRight /></Link></div></footer>
      {cancelOpen && <div className="support-cancel"><div role="alertdialog" aria-modal="true" aria-labelledby="cancel-support-title"><WarningCircle /><h3 id="cancel-support-title">Cancel your support request?</h3><p>Psychologists will stop seeing this request. You can start another request whenever you need.</p><div><button type="button" onClick={() => setCancelOpen(false)}>Keep matching</button><button type="button" onClick={cancelRequest}>Cancel request</button></div></div></div>}
    </BlurFade>;
  }

  if (state === "allocated") return <BlurFade className="support-allocated-card" aria-live="assertive"><ShineBorder duration={8} /><div className="support-allocated-card__mark"><CheckCircle weight="fill" /></div><span>Psychologist allocated</span><h2>Your secure session is ready</h2><p>A verified Bodhi-Mitra psychologist accepted your request. Preparing your private conversation now.</p><div className="support-allocated-card__loading"><i /><i /><i /></div><small><ShieldCheck weight="fill" /> Opening the session securely</small></BlurFade>;

  if (state === "timeout") return <BlurFade className="support-timeout-card"><div><WarningCircle weight="duotone" /><span><small>No psychologist accepted in time</small><h2>You still have immediate support options</h2><p>You can try matching again or call a support line directly.</p></span></div><div className="support-timeout-actions"><Button onClick={() => { setHotlines([]); setState("preferences"); }}>Try again</Button><Link to="/emergency">View emergency support</Link></div>{hotlines.length > 0 && <div className="support-hotlines">{hotlines.slice(0, 2).map(line => <a key={line.number} href={`tel:${line.number}`}><Phone weight="fill" /><span><strong>{line.label}</strong><small>{line.number}</small></span></a>)}</div>}</BlurFade>;

  return <><BlurFade className="request-card support-request-card" delay={0.1}><ShineBorder duration={12} /><span><Heartbeat weight="duotone" /></span><div className="request-card__copy"><small className="request-card__eyebrow">Immediate, confidential support</small><h2>You do not have to carry it alone.</h2><p>Choose how you want to connect with a university-approved psychologist. You decide what to share.</p></div><Button onClick={() => { setError(""); setState("preferences"); }}><ShieldCheck /> Request support</Button></BlurFade>
    {error && state === "idle" && <div className="support-flow-error" role="alert"><WarningCircle /> {error}</div>}
    {(state === "preferences" || state === "submitting") && <div className="support-preferences-backdrop"><section className="support-preferences" role="dialog" aria-modal="true" aria-labelledby="support-preferences-title">
      <button ref={dialogClose} className="support-preferences__close" onClick={() => state !== "submitting" && setState("idle")} aria-label="Close support request"><X /></button>
      <header><span><ShieldCheck weight="duotone" /></span><div><small>Private support request</small><h2 id="support-preferences-title">How would you like to connect?</h2><p>These details help route your request. Your psychologist will not see your identity.</p></div></header>
      <fieldset className="support-mode-picker"><legend>Choose a session format</legend>{modes.map(item => { const Icon = item.icon; return <button type="button" key={item.value} className={mode === item.value ? "selected" : ""} aria-pressed={mode === item.value} onClick={() => setMode(item.value)} disabled={state === "submitting"}><Icon weight="duotone" /><span><strong>{item.label}</strong><small>{item.description}</small></span>{mode === item.value && <CheckCircle weight="fill" />}</button>; })}</fieldset>
      <fieldset className="support-mood-picker"><legend>What feels closest right now?</legend>{moods.map(item => { const Icon = item.icon; return <button type="button" key={item.label} className={mood === item.label ? "selected" : ""} aria-pressed={mood === item.label} onClick={() => setMood(item.label)} disabled={state === "submitting"}><Icon weight="duotone" />{item.label}</button>; })}</fieldset>
      <label className="support-priority"><span><WarningCircle /><span><strong>I need priority support</strong><small>Use this when waiting feels unsafe or difficult.</small></span></span><input type="checkbox" checked={urgent} onChange={event => setUrgent(event.target.checked)} disabled={state === "submitting"} /></label>
      {error && <div className="support-flow-error" role="alert"><WarningCircle /> {error}</div>}
      <footer><span><LockKey weight="fill" /> Identity protected during matching</span><Button onClick={submitRequest} disabled={!mood || state === "submitting"}>{state === "submitting" ? "Protecting your request..." : "Start secure matching"}<ArrowRight /></Button></footer>
    </section></div>}
  </>;
}
