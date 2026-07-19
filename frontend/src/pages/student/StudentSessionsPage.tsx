import { useEffect, useMemo, useState, type ElementType } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowsClockwise,
  CalendarBlank,
  ChatCircleDots,
  CheckCircle,
  ClockCounterClockwise,
  Hourglass,
  LockKey,
  Phone,
  ShieldCheck,
  Sparkle,
  VideoCamera,
  WarningCircle,
  XCircle
} from "@phosphor-icons/react";
import { BlurFade, NumberTicker, ShineBorder } from "../../components/magicui/ProfileMagic";
import { SpotlightCard } from "../../components/reactbits/SpotlightCard";
import { TextReveal } from "../../components/reactbits/TextReveal";
import { Button } from "../../components/ui/Button";
import { api } from "../../lib/api";

type SessionMode = "chat" | "voice" | "video";
type SessionStatus = "pending" | "matched" | "timeout" | "cancelled" | "ended";
type SessionFilter = "all" | "active" | "completed" | "interrupted";

type HistoryRow = {
  _id: string;
  mode: SessionMode;
  status: SessionStatus;
  createdAt: string;
  matchedAt?: string;
};

const filters: { value: SessionFilter; label: string }[] = [
  { value: "all", label: "All sessions" },
  { value: "completed", label: "Completed" },
  { value: "active", label: "In progress" },
  { value: "interrupted", label: "Not completed" }
];

const modeDetails: Record<SessionMode, { label: string; Icon: ElementType }> = {
  chat: { label: "Chat", Icon: ChatCircleDots },
  voice: { label: "Voice", Icon: Phone },
  video: { label: "Video", Icon: VideoCamera }
};

const statusDetails: Record<SessionStatus, { label: string; description: string; Icon: ElementType }> = {
  ended: { label: "Completed", description: "This support session was completed.", Icon: CheckCircle },
  matched: { label: "Connected", description: "You were connected with a psychologist.", Icon: ShieldCheck },
  pending: { label: "Waiting", description: "Your support request is still in the queue.", Icon: Hourglass },
  timeout: { label: "No match", description: "A psychologist could not be matched in time.", Icon: WarningCircle },
  cancelled: { label: "Cancelled", description: "This support request was cancelled.", Icon: XCircle }
};

function belongsToFilter(row: HistoryRow, filter: SessionFilter) {
  if (filter === "completed") return row.status === "ended";
  if (filter === "active") return row.status === "pending" || row.status === "matched";
  if (filter === "interrupted") return row.status === "timeout" || row.status === "cancelled";
  return true;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function StudentSessionsPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [filter, setFilter] = useState<SessionFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<{ requests: HistoryRow[] }>("/student/history")
      .then(response => {
        if (active) setRows(Array.isArray(response.requests) ? response.requests : []);
      })
      .catch(() => {
        if (active) setError("We could not refresh your session history. Check your connection and try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [reloadKey]);

  const visibleRows = useMemo(() => rows.filter(row => belongsToFilter(row, filter)), [filter, rows]);
  const completed = rows.filter(row => row.status === "ended").length;
  const modesUsed = new Set(rows.map(row => row.mode)).size;
  const activeSessions = rows.filter(row => row.status === "pending" || row.status === "matched").length;

  return (
    <section className="student-page student-session-history-page">
      <BlurFade className="student-session-hero">
        <ShineBorder duration={14} />
        <div className="student-session-hero__copy">
          <span className="student-session-eyebrow"><LockKey weight="fill" /> Private session record</span>
          <TextReveal as="h1" text="Your support history, kept intentionally simple." delay={0.04} />
          <p>Review when you connected and which support format you used. The personal part of every conversation stays out of this timeline.</p>
          <Link to="/student">Request support <ArrowRight weight="bold" /></Link>
        </div>
        <div className="student-session-hero__privacy">
          <span><ShieldCheck weight="duotone" /></span>
          <div>
            <small>Privacy by design</small>
            <strong>Your conversations are not stored here.</strong>
            <p>Only the session mode, status, and time appear in your history.</p>
          </div>
        </div>
      </BlurFade>

      <BlurFade className="student-session-stats" delay={0.08}>
        <article><span><ClockCounterClockwise /></span><div><strong><NumberTicker value={rows.length} /></strong><small>Total sessions</small></div></article>
        <article><span><CheckCircle /></span><div><strong><NumberTicker value={completed} /></strong><small>Completed</small></div></article>
        <article><span><Sparkle /></span><div><strong><NumberTicker value={modesUsed} /></strong><small>Support modes used</small></div></article>
        <article><span><Hourglass /></span><div><strong><NumberTicker value={activeSessions} /></strong><small>In progress</small></div></article>
      </BlurFade>

      <BlurFade className="student-session-timeline" delay={0.12}>
        <header className="student-session-timeline__header">
          <div>
            <span><CalendarBlank weight="duotone" /> Your timeline</span>
            <h2>Session activity</h2>
            <p>Newest activity appears first.</p>
          </div>
          <div className="student-session-filters" aria-label="Filter session history">
            {filters.map(item => (
              <button
                type="button"
                className={filter === item.value ? "is-active" : ""}
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                key={item.value}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="student-session-loading" aria-live="polite" aria-label="Loading session history">
            {[0, 1, 2].map(item => <div key={item}><i /><span><b /><small /></span><em /></div>)}
          </div>
        ) : error ? (
          <div className="student-session-state" role="alert">
            <span><WarningCircle weight="duotone" /></span>
            <h3>Session history is temporarily unavailable</h3>
            <p>{error}</p>
            <Button onClick={() => setReloadKey(value => value + 1)}><ArrowsClockwise /> Try again</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="student-session-state student-session-state--empty">
            <span><ChatCircleDots weight="duotone" /></span>
            <h3>Your timeline is ready when you are</h3>
            <p>After you connect with a psychologist, a private session record will appear here.</p>
            <Link className="button button--primary" to="/student">Request support <ArrowRight /></Link>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="student-session-state student-session-state--compact">
            <span><ClockCounterClockwise weight="duotone" /></span>
            <h3>No sessions in this view</h3>
            <p>Choose another filter to see the rest of your history.</p>
            <button type="button" onClick={() => setFilter("all")}>Show all sessions</button>
          </div>
        ) : (
          <div className="student-session-records">
            {visibleRows.map((row, index) => {
              const mode = modeDetails[row.mode] ?? modeDetails.chat;
              const status = statusDetails[row.status] ?? statusDetails.cancelled;
              const ModeIcon = mode.Icon;
              const StatusIcon = status.Icon;
              return (
                <BlurFade delay={Math.min(index, 6) * 0.045} key={row._id}>
                  <SpotlightCard className={`student-session-record student-session-record--${row.status}`}>
                    <div className="student-session-record__mode"><ModeIcon weight="duotone" /></div>
                    <div className="student-session-record__body">
                      <div>
                        <small>{mode.label} support</small>
                        <h3>{mode.label} session</h3>
                      </div>
                      <p>{status.description}</p>
                      <time dateTime={row.createdAt}><CalendarBlank /> {formatDate(row.createdAt)}</time>
                    </div>
                    <span className={`student-session-status student-session-status--${row.status}`}><StatusIcon weight="fill" /> {status.label}</span>
                  </SpotlightCard>
                </BlurFade>
              );
            })}
          </div>
        )}
      </BlurFade>

      <BlurFade className="student-session-footer-note" delay={0.18}>
        <ShieldCheck weight="duotone" />
        <div><strong>A record without the conversation.</strong><p>Bodhi-Mitra keeps this page useful while protecting what you shared during support.</p></div>
        <Link to="/privacy">How privacy works <ArrowRight /></Link>
      </BlurFade>
    </section>
  );
}
