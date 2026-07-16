import {
  Bell,
  CalendarCheck,
  ChatCircleDots,
  CheckCircle,
  Clock,
  LockKey,
  MagnifyingGlass,
  Microphone,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserCircle,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SOCKET_EVENTS, type PendingEmergency, type SessionMatch } from "@bodhi/shared";
import { api } from "../../lib/api";
import { enablePush } from "../../lib/push";
import { getSocket } from "../../lib/socket";
import { Button } from "../../components/ui/Button";

const icons = { chat: ChatCircleDots, voice: Microphone, video: VideoCamera };

function Queue({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<PendingEmergency[]>([]);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api<{ requests: PendingEmergency[] }>("/psychologist/queue").then((result) => setRows(result.requests));
    const socket = getSocket();
    const add = (row: PendingEmergency) => setRows((current) => current.some((item) => item.requestId === row.requestId) ? current : [...current, row]);
    const remove = ({ requestId }: { requestId: string }) => setRows((current) => current.filter((item) => item.requestId !== requestId));
    const matched = (match: SessionMatch) => navigate(`/psychologist/session/${match.sessionId}`, { state: match });
    socket.on(SOCKET_EVENTS.EMERGENCY_NEW, add);
    socket.on(SOCKET_EVENTS.EMERGENCY_TAKEN, remove);
    socket.on(SOCKET_EVENTS.SESSION_MATCHED, matched);
    return () => {
      socket.off(SOCKET_EVENTS.EMERGENCY_NEW, add);
      socket.off(SOCKET_EVENTS.EMERGENCY_TAKEN, remove);
      socket.off(SOCKET_EVENTS.SESSION_MATCHED, matched);
    };
  }, [navigate]);

  function accept(requestId: string) {
    setAccepting(requestId);
    setError("");
    getSocket().emit(SOCKET_EVENTS.EMERGENCY_ACCEPT, { requestId }, (result: { ok: boolean; message?: string }) => {
      if (!result.ok) {
        setError(result.message ?? "This request is no longer available.");
        setAccepting("");
      }
    });
  }

  return (
    <div className="psych-queue">
      {error && <div className="form-error">{error}</div>}
      {rows.length ? rows.slice(0, compact ? 4 : 50).map((row) => {
        const Icon = icons[row.mode];
        const wait = Math.max(0, Math.floor((Date.now() - new Date(row.waitStartedAt).getTime()) / 1000));
        return (
          <article key={row.requestId}>
            <div className="queue-mode"><Icon weight="duotone" /></div>
            <div className="queue-person">
              <strong>{row.anonId}</strong>
              <span>{row.mode} support</span>
              <small><Clock /> Waiting {Math.floor(wait / 60)}m {wait % 60}s</small>
            </div>
            <Button disabled={accepting === row.requestId} onClick={() => accept(row.requestId)}>
              {accepting === row.requestId ? "Connecting..." : "Accept request"}
            </Button>
          </article>
        );
      }) : (
        <div className="psych-empty">
          <span><CheckCircle weight="duotone" /></span>
          <h3>The queue is clear</h3>
          <p>You are ready. New student requests will appear here automatically.</p>
        </div>
      )}
    </div>
  );
}

export function PsychologistOverview() {
  const [data, setData] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<any>("/psychologist/summary")
      .then((result) => setData(result.summary))
      .catch((cause) => setError(cause.message));
  }, []);

  async function availability() {
    const next = !data.profile.isAvailable;
    const result = await api<any>("/psychologist/availability", { method: "PATCH", body: JSON.stringify({ isAvailable: next }) });
    setData({ ...data, profile: { ...data.profile, isAvailable: result.isAvailable } });
  }

  async function notifications() {
    try {
      await enablePush();
      setNotice("Browser notifications are enabled.");
    } catch (caught) {
      setNotice((caught as Error).message);
    }
  }

  if (error) return <div className="psych-state psych-state--error"><WarningCircle /><h2>Dashboard unavailable</h2><p>{error}</p><Button onClick={() => window.location.reload()}>Try again</Button></div>;
  if (!data) return <div className="psych-loading"><span /><span /><span /><p>Preparing your clinical dashboard...</p></div>;

  return (
    <section className="psych-page psych-overview">
      <header className="psych-command-head">
        <div className="psych-command-copy">
          <span className="psych-command-mark"><ShieldCheck weight="duotone" /></span>
          <div>
            <p>Clinical support dashboard</p>
            <h1>Good to see you, {data.profile.fullName}</h1>
            <span>{data.profile.professionalTitle}</span>
          </div>
        </div>
        <button className={`availability${data.profile.isAvailable ? " active" : ""}`} onClick={availability} aria-pressed={data.profile.isAvailable}>
          {data.profile.isAvailable ? <ToggleRight weight="fill" /> : <ToggleLeft />}
          <span><strong>{data.profile.isAvailable ? "Available for requests" : "Currently unavailable"}</strong><small>{data.profile.isAvailable ? "Live queue alerts are active" : "Turn on when you are ready"}</small></span>
        </button>
      </header>

      {notice && <div className="psych-notice" role="status"><CheckCircle />{notice}</div>}

      <section className="psych-metrics" aria-label="Session summary">
        <article className="psych-metric-primary"><ChatCircleDots weight="duotone" /><div><span>Waiting now</span><strong>{data.pendingRequests}</strong><small>{data.pendingRequests ? "Students need support" : "Queue is currently clear"}</small></div></article>
        <article><CalendarCheck weight="duotone" /><div><span>Today</span><strong>{data.sessionsToday}</strong><small>completed sessions</small></div></article>
        <article><UserCircle weight="duotone" /><div><span>All time</span><strong>{data.totalSessions}</strong><small>students supported</small></div></article>
        <article><Clock weight="duotone" /><div><span>Average</span><strong>{data.averageDurationMinutes}<i> min</i></strong><small>session duration</small></div></article>
      </section>

      <div className="psych-workspace-grid">
        <section className="psych-queue-panel">
          <div className="psych-section-head">
            <div><h2>Live support queue</h2><p>Accepting a request creates a private session immediately.</p></div>
            <span className={data.pendingRequests ? "has-pending" : ""}>{data.pendingRequests} waiting</span>
          </div>
          <Queue compact />
        </section>

        <aside className="psych-care-rail">
          <section className="psych-readiness-panel">
            <div className="psych-section-head"><div><h2>Session readiness</h2><p>Prepare before a request arrives.</p></div></div>
            <button className="psych-notification-button" onClick={notifications}><Bell weight="duotone" /><span><strong>Browser notifications</strong><small>Receive alerts outside this tab</small></span></button>
            <div className="readiness"><LockKey weight="duotone" /><span><strong>Identity shield active</strong><small>Student account details remain hidden.</small></span></div>
            <div className="readiness"><WarningCircle weight="duotone" /><span><strong>Safety tools ready</strong><small>Escalation remains available during sessions.</small></span></div>
          </section>

          <section className="psych-mode-panel">
            <div className="psych-section-head"><div><h2>Session mix</h2><p>Distribution across support modes.</p></div><Link to="/psychologist/sessions">View history</Link></div>
            <div className="psych-mode-list">
              {data.modeMix.length ? data.modeMix.map((row: any) => {
                const Icon = icons[row.label as keyof typeof icons] ?? ChatCircleDots;
                return <div className="mode-row" key={row.label}><span><Icon />{row.label}</span><b>{row.count}</b></div>;
              }) : <p className="psych-mode-empty">Session activity will appear here.</p>}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

export const LiveQueue = PsychologistOverview;

export function PsychologistSessions() {
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  useEffect(() => { api<any>("/psychologist/sessions").then((result) => setRows(result.sessions)); }, []);
  const filtered = useMemo(() => rows.filter((row) => (mode === "all" || row.mode === mode) && row.sessionId.toLowerCase().includes(query.toLowerCase())), [rows, mode, query]);
  return <section className="psych-page"><div className="psych-section-head"><div><h1>Session history</h1><p>Metadata only. Conversation content is never retained here.</p></div></div><div className="psych-filters"><label><MagnifyingGlass /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search session ID" /></label><select value={mode} onChange={(event) => setMode(event.target.value)}><option value="all">All modes</option><option value="chat">Chat</option><option value="voice">Voice</option><option value="video">Video</option></select></div><div className="psych-history">{filtered.length ? filtered.map((row) => { const Icon = icons[row.mode as keyof typeof icons]; const duration = row.endedAt ? Math.max(1, Math.round((new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime()) / 60000)) : null; return <article key={row._id}><Icon /><div><strong>{row.sessionId.slice(0, 12)}</strong><span>{new Date(row.startedAt).toLocaleString()}</span></div><b>{row.mode}</b><span>{duration ? `${duration} min` : "Active"}</span></article>; }) : <div className="psych-empty">No sessions match this filter.</div>}</div></section>;
}

export function PsychologistProfile() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api<any>("/psychologist/profile").then((result) => setData(result.profile)); }, []);
  if (!data) return <div className="psych-loading"><p>Loading profile...</p></div>;
  return <section className="psych-page"><div className="psych-profile"><div className="psych-profile-cover" /><div className="psych-profile-avatar"><UserCircle /></div><h1>{data.fullName}</h1><p>{data.professionalTitle}</p><div className="verified-badge"><ShieldCheck /> University verified professional</div><div className="psych-profile-info"><div><small>Work email</small><strong>{data.email}</strong></div><div><small>Account status</small><strong>{data.isAvailable ? "Available" : "Unavailable"}</strong></div><div><small>Specializations</small><p>{data.specializations.join(", ")}</p></div><div><small>Member since</small><strong>{new Date(data.createdAt).toLocaleDateString()}</strong></div></div></div></section>;
}
