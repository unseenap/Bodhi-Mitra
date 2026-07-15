import {
  ArrowRight,
  ChatCircleDots,
  CheckCircle,
  LockKey,
  Microphone,
  Phone,
  ShieldCheck,
  SignIn,
  User,
  UserPlus,
  VideoCamera,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SOCKET_EVENTS, type Hotline, type PendingEmergency, type SessionMatch, type SessionMode } from "@bodhi/shared";
import { useAuth } from "../../context/AuthContext";
import { getSocket } from "../../lib/socket";

const choices = [
  { mode: "chat" as const, icon: ChatCircleDots, title: "Chat", text: "Type at your own pace" },
  { mode: "voice" as const, icon: Microphone, title: "Voice", text: "Talk without a camera" },
  { mode: "video" as const, icon: VideoCamera, title: "Video", text: "Meet face to face" },
];

export function EmergencyFlow() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<SessionMode>("chat");
  const [state, setState] = useState<"ready" | "waiting" | "timeout">("ready");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [request, setRequest] = useState<PendingEmergency | null>(null);
  const [hotlines, setHotlines] = useState<Hotline[]>([]);
  const [error, setError] = useState("");
  const started = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state !== "waiting") return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (!user || user.role !== "student") return;
    const socket = getSocket();
    const queued = (value: PendingEmergency) => {
      setSending(false);
      setRequest(value);
      started.current = Date.now();
      setElapsed(0);
      setState("waiting");
    };
    const matched = (match: SessionMatch) => navigate(`/student/session/${match.sessionId}`, { state: match });
    const timeout = (payload: { hotlines: Hotline[] }) => {
      setSending(false);
      setHotlines(payload.hotlines);
      setState("timeout");
    };
    socket.on(SOCKET_EVENTS.EMERGENCY_QUEUED, queued);
    socket.on(SOCKET_EVENTS.SESSION_MATCHED, matched);
    socket.on(SOCKET_EVENTS.EMERGENCY_TIMEOUT, timeout);
    return () => {
      socket.off(SOCKET_EVENTS.EMERGENCY_QUEUED, queued);
      socket.off(SOCKET_EVENTS.SESSION_MATCHED, matched);
      socket.off(SOCKET_EVENTS.EMERGENCY_TIMEOUT, timeout);
    };
  }, [user, navigate]);

  function start() {
    setConfirming(false);
    setSending(true);
    setError("");
    getSocket().emit(SOCKET_EVENTS.EMERGENCY_REQUEST, { mode }, (result: { ok: boolean; message?: string }) => {
      if (!result.ok) {
        setSending(false);
        setError(result.message ?? "We could not send the request. Please call a hotline below.");
      }
    });
  }

  function cancel() {
    if (request) getSocket().emit(SOCKET_EVENTS.EMERGENCY_CANCEL, { requestId: request.requestId });
    setState("ready");
    setRequest(null);
  }

  const pageHeader = <header className="crisis-head"><span><Warning weight="fill" /></span><h1>Emergency Mental Health Support</h1><p>You are not alone. Help is available right now.</p></header>;

  if (loading) return <main className="crisis-page"><div className="crisis-skeleton" aria-label="Loading emergency support"><span /><span /><span /></div></main>;

  if (!user) return <main className="crisis-page">{pageHeader}<section className="crisis-gate"><span><User weight="duotone" /></span><h2>Please sign in</h2><p>To request immediate support from a psychologist, sign in or create your student account.</p><div><Link className="crisis-button crisis-button--primary" to="/login"><SignIn /> Login</Link><Link className="crisis-button crisis-button--outline" to="/register"><UserPlus /> Register</Link></div><HotlineStrip /></section></main>;

  if (user.role !== "student") return <main className="crisis-page">{pageHeader}<section className="crisis-gate"><span><ShieldCheck weight="duotone" /></span><h2>Student access only</h2><p>This request pathway is available only to student accounts. You can still use the emergency numbers below.</p><Link className="crisis-button crisis-button--primary" to={`/${user.role}`}>Go to dashboard <ArrowRight /></Link><HotlineStrip /></section></main>;

  if (state === "waiting") return <main className="crisis-page">{pageHeader}<section className="crisis-waiting"><div className="crisis-waiting__visual"><span className="crisis-radar"><CheckCircle weight="fill" /></span><img src="/images/pschylogo.svg" alt="Bodhi-Mitra support" /></div><p className="crisis-kicker">Request sent successfully</p><h2>We are alerting available psychologists</h2><p>Keep this page open. You will enter the private session automatically when a psychologist accepts.</p><strong className="crisis-timer" aria-label={`${elapsed} seconds waiting`}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</strong><div className="crisis-waiting__facts"><span><LockKey /> Your identity remains shielded</span><span><ChatCircleDots /> Selected mode: {mode}</span></div><div className="crisis-waiting__actions"><Link className="crisis-button crisis-button--primary" to="/student">Go to my dashboard</Link><button className="crisis-button crisis-button--quiet" onClick={cancel}><X /> Cancel request</button></div><HotlineStrip /></section></main>;

  if (state === "timeout") return <main className="crisis-page">{pageHeader}<section className="crisis-timeout"><span><Phone weight="fill" /></span><h2>Please call for support now</h2><p>No psychologist accepted in time. These services can connect you directly.</p><div className="crisis-hotline-list">{hotlines.map(hotline => <a key={hotline.label} href={`tel:${hotline.number.replace(/\s/g, "")}`}><Phone weight="fill" /><span><strong>{hotline.label}</strong><small>{hotline.available}</small></span><b>{hotline.number}</b></a>)}</div><button className="crisis-button crisis-button--outline" onClick={() => setState("ready")}>Try Bodhi-Mitra again</button></section></main>;

  return <main className="crisis-page">{pageHeader}<div className="crisis-layout"><section className="crisis-request"><div className="crisis-request__intro"><span><Phone weight="duotone" /></span><div><h2>Immediate help is available</h2><p>Your request will be sent to all available, verified psychologists.</p></div></div><div className="crisis-danger"><Warning weight="fill" /><p><strong>Are you in immediate physical danger?</strong> Call emergency services at <a href="tel:112">112</a> or go to your nearest hospital.</p></div><fieldset><legend>How would you like to connect?</legend><div className="crisis-modes">{choices.map(({ mode: value, icon: Icon, title, text }) => <button type="button" key={value} className={mode === value ? "crisis-mode crisis-mode--active" : "crisis-mode"} onClick={() => setMode(value)} aria-pressed={mode === value}><Icon weight="duotone" /><span><strong>{title}</strong><small>{text}</small></span><CheckCircle weight="fill" /></button>)}</div></fieldset>{error && <div className="crisis-error" role="alert"><Warning weight="fill" />{error}</div>}<button className="crisis-button crisis-button--emergency" disabled={sending} onClick={() => setConfirming(true)}>{sending ? <><span className="crisis-spinner" /> Sending request...</> : <><Warning weight="fill" /> Request emergency help now</>}</button><p className="crisis-privacy"><LockKey /> Your identity is verified by Bodhi-Mitra but not shown to the psychologist.</p></section><aside className="crisis-illustration"><img src="/support-space.webp" alt="A calm private space for receiving support" /><div><ShieldCheck weight="duotone" /><span><strong>Safe and confidential</strong>Your session is designed around privacy, dignity, and professional care.</span></div><ol><li><b>1</b><span><strong>Send your request</strong>Available psychologists are alerted instantly.</span></li><li><b>2</b><span><strong>Stay on this page</strong>The first available professional accepts.</span></li><li><b>3</b><span><strong>Connect privately</strong>Your session opens automatically.</span></li></ol></aside></div><HotlineStrip />{confirming && <div className="crisis-confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirming(false); }}><section className="crisis-confirm" role="alertdialog" aria-modal="true" aria-labelledby="crisis-confirm-title" aria-describedby="crisis-confirm-copy"><button className="crisis-confirm__close" onClick={() => setConfirming(false)} aria-label="Close confirmation"><X /></button><span className="crisis-confirm__icon"><Warning weight="fill" /></span><h2 id="crisis-confirm-title">Are you sure you want to proceed?</h2><p id="crisis-confirm-copy">Confirming will immediately alert all available psychologists and begin priority matching for a private {mode} session.</p><div className="crisis-confirm__notice"><ShieldCheck weight="duotone" /><span><strong>Your request is private</strong>Your identity will remain shielded from the psychologist.</span></div><div className="crisis-confirm__actions"><button className="crisis-button crisis-button--quiet" onClick={() => setConfirming(false)}>No, go back</button><button className="crisis-button crisis-button--emergency" onClick={start}><Warning weight="fill" /> Yes, send request</button></div><a href="tel:112"><Phone weight="fill" /> In immediate danger? Call 112</a></section></div>}</main>;
}

function HotlineStrip() {
  return <div className="crisis-direct"><span>Need direct help instead?</span><a href="tel:112"><Phone weight="fill" /><strong>Emergency</strong>112</a><a href="tel:+911212121212"><Phone weight="fill" /><strong>GBU crisis line</strong>+91 1212121212</a><a href="tel:14416"><Phone weight="fill" /><strong>Tele-MANAS</strong>14416</a></div>;
}
