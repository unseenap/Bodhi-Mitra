import {
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  ArrowClockwise,
  ArrowLeft,
  ChatCircleDots,
  Check,
  CheckCircle,
  DownloadSimple,
  Heart,
  Info,
  LockKey,
  Microphone,
  MicrophoneSlash,
  NotePencil,
  PaperPlaneTilt,
  Pause,
  PhoneDisconnect,
  Play,
  Pulse,
  ShieldCheck,
  Sparkle,
  SpeakerHigh,
  Star,
  UserCircle,
  VideoCamera,
  VideoCameraSlash,
  Warning,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import type { SessionMatch } from "@bodhi/shared";
import { Button } from "../ui/Button";

export type SessionMessage = {
  id: string;
  body: string;
  sentAt: string;
  sender: string;
  own?: boolean;
};
type MatchContext =
  | (SessionMatch & { mood?: string; urgent?: boolean })
  | undefined;
type CommonProps = {
  sessionId: string;
  match: MatchContext;
  messages: SessionMessage[];
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  paused: boolean;
  setPaused: Dispatch<SetStateAction<boolean>>;
  ended: boolean;
  toast: string;
  setToast: Dispatch<SetStateAction<string>>;
  time: string;
  bottom: RefObject<HTMLDivElement | null>;
  submit: (event: FormEvent) => void;
  handleKeys: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  endSession: () => void;
  saveTranscript: () => void;
  escalate: () => void;
  localVideo: RefObject<HTMLVideoElement | null>;
  remoteVideo: RefObject<HTMLVideoElement | null>;
  muted: boolean;
  cameraOff: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  mediaError: string;
  callStatus: "connecting" | "connected" | "reconnecting" | "failed";
  retryMedia: () => void;
  remotePlaybackBlocked: boolean;
  remoteAudioReady: boolean;
  resumeRemoteAudio: () => void;
};

const studentReplies = [
  "I'm feeling anxious",
  "I need a moment",
  "I'm not sure how to explain",
  "Can we talk more?",
  "Thank you for listening",
];
const clinicianReplies = [
  "Take your time. I'm here.",
  "What feels most important right now?",
  "Would you like to pause?",
  "Can you tell me more about that?",
  "You did the right thing by reaching out.",
];

function Toast({ text, close }: { text: string; close: () => void }) {
  return text ? (
    <div className="role-session-toast" role="status">
      <CheckCircle weight="fill" />
      <span>{text}</span>
      <button onClick={close} aria-label="Dismiss">
        <X />
      </button>
    </div>
  ) : null;
}
function MessageList({
  messages,
  bottom,
  emptyTitle,
  emptyBody,
  psychologist,
  student,
}: {
  messages: SessionMessage[];
  bottom: CommonProps["bottom"];
  emptyTitle: string;
  emptyBody: string;
  psychologist?: boolean;
  student?: boolean;
}) {
  return (
    <div
      className={`role-chat__messages${student ? " student-chat__messages" : ""}`}
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-label="Session messages"
    >
      {!messages.length && (
        <div
          className={`role-chat__empty${student ? " student-chat__empty" : ""}`}
        >
          <span>
            {psychologist ? (
              <ChatCircleDots weight="duotone" />
            ) : (
              <Heart weight="duotone" />
            )}
          </span>
          <h2>{emptyTitle}</h2>
          <p>{emptyBody}</p>
          <small>
            <ShieldCheck weight="fill" /> Private session with protected
            identity
          </small>
        </div>
      )}
      {!!messages.length && student && (
        <div className="student-chat__day">
          <span>Today</span>
        </div>
      )}
      {messages.map((message) => (
        <div
          key={message.id}
          className={`role-message ${message.own ? "role-message--own" : ""}${student ? " student-chat__message" : ""}`}
        >
          <div>
            {student && !message.own && (
              <span className="student-chat__sender">Psychologist</span>
            )}
            <p>{message.body}</p>
            <small>
              <span>
                {message.own
                  ? "You"
                  : psychologist
                    ? "Student"
                    : "Psychologist"}
              </span>
              <time dateTime={message.sentAt}>
                {new Date(message.sentAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              {message.own && <Check weight="bold" aria-label="Sent" />}
            </small>
          </div>
        </div>
      ))}
      <div className="role-chat__bottom" ref={bottom} />
    </div>
  );
}
function Composer({
  draft,
  setDraft,
  submit,
  handleKeys,
  replies,
  disabled,
  placeholder,
  student,
}: Pick<CommonProps, "draft" | "setDraft" | "submit" | "handleKeys"> & {
  replies: string[];
  disabled: boolean;
  placeholder: string;
  student?: boolean;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = textarea.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 144)}px`;
  }, [draft]);

  return (
    <div className={`role-composer${student ? " student-chat__composer" : ""}`}>
      <div
        className="role-composer__suggestions"
        aria-label="Suggested replies"
      >
        {replies.map((reply) => (
          <button
            key={reply}
            type="button"
            onClick={() => {
              setDraft(reply);
              window.requestAnimationFrame(() => textarea.current?.focus());
            }}
            disabled={disabled}
          >
            {reply}
          </button>
        ))}
      </div>
      <form onSubmit={submit}>
        <label
          className="sr-only"
          htmlFor={student ? "student-session-message" : "session-message"}
        >
          Message
        </label>
        <textarea
          id={student ? "student-session-message" : "session-message"}
          ref={textarea}
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeys}
          placeholder={disabled ? "This session has ended" : placeholder}
          disabled={disabled}
          maxLength={4000}
          aria-describedby={student ? "student-composer-help" : undefined}
        />
        <span aria-hidden="true">{draft.length}/4000</span>
        <Button
          type="submit"
          disabled={disabled || !draft.trim()}
          aria-label="Send message"
        >
          <PaperPlaneTilt weight="fill" />
        </Button>
      </form>
      <small id={student ? "student-composer-help" : undefined}>
        Enter to send. Shift + Enter adds a new line.
      </small>
    </div>
  );
}
function CallStage(props: CommonProps & { psychologist?: boolean }) {
  const statusText = {
    connecting: "Connecting securely",
    connected: "Connected",
    reconnecting: "Reconnecting",
    failed: "Connection failed",
  }[props.callStatus];
  const isVoice = props.match?.mode === "voice";
  const peer =
    props.match?.peerLabel ??
    (props.psychologist ? "Anonymous student" : "Bodhi-Mitra professional");
  return (
    <div
      className={`role-call role-call--${isVoice ? "voice" : "video"} ${props.psychologist ? "role-call--clinician" : ""}`}
    >
      <video
        className="role-call__remote"
        ref={props.remoteVideo}
        autoPlay
        playsInline
      />
      {!isVoice && (
        <video
          className={`role-call__local ${props.cameraOff ? "is-off" : ""}`}
          ref={props.localVideo}
          autoPlay
          playsInline
          muted
        />
      )}
      {isVoice && (
        <video
          className="role-call__audio-source"
          ref={props.localVideo}
          autoPlay
          playsInline
          muted
        />
      )}
      <div className="role-call__topline">
        <div
          className={`role-call__status role-call__status--${props.callStatus}`}
          role="status"
          aria-live="polite"
        >
          <i />
          {statusText}
        </div>
        <span>
          <LockKey weight="fill" /> Encrypted in transit
        </span>
      </div>
      <div className="role-call__identity">
        <span>
          {props.psychologist ? "Anonymous student" : "Verified psychologist"}
        </span>
        <strong>{peer}</strong>
      </div>
      {isVoice && (
        <div className="role-call__voice-focus">
          <div className="role-call__avatar">
            {peer.charAt(0).toUpperCase()}
            <span className={props.remoteAudioReady ? "is-ready" : ""} />
          </div>
          <p>
            {props.callStatus === "connected" && props.remoteAudioReady
              ? "Voice connected · audio receiving"
              : statusText}
          </p>
          <div
            className={`role-call__wave ${props.remoteAudioReady ? "is-ready" : ""}`}
            aria-hidden="true"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
              <i key={bar} />
            ))}
          </div>
          <small>
            {props.remoteAudioReady
              ? "The other participant's audio track is active"
              : "Waiting for the other participant's audio"}
          </small>
        </div>
      )}
      {props.cameraOff && !isVoice && (
        <div className="role-call__camera-off">
          <VideoCameraSlash />
          <strong>Your camera is off</strong>
        </div>
      )}
      {props.mediaError && (
        <div className="role-call__error" role="alert">
          <WarningCircle />
          <span>
            <strong>Call needs attention</strong>
            {props.mediaError}
            <span>
              <button onClick={props.retryMedia}>
                <ArrowClockwise /> Retry call
              </button>
              <a href="tel:+919650257255">Call campus hotline</a>
            </span>
          </span>
        </div>
      )}
      {props.remotePlaybackBlocked && (
        <button
          className="role-call__sound-prompt"
          onClick={props.resumeRemoteAudio}
        >
          <SpeakerHigh weight="fill" /> Tap to hear the other person
        </button>
      )}
      <div className="role-call__controls" aria-label="Call controls">
        <button
          className={props.muted ? "is-active" : ""}
          onClick={props.toggleAudio}
          aria-label={props.muted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={props.muted}
        >
          {props.muted ? <MicrophoneSlash /> : <Microphone />}
          <span>{props.muted ? "Unmute" : "Mute"}</span>
        </button>
        {props.match?.mode === "video" && (
          <button
            className={props.cameraOff ? "is-active" : ""}
            onClick={props.toggleVideo}
            aria-label={props.cameraOff ? "Turn camera on" : "Turn camera off"}
            aria-pressed={props.cameraOff}
          >
            {props.cameraOff ? <VideoCameraSlash /> : <VideoCamera />}
            <span>{props.cameraOff ? "Camera on" : "Camera off"}</span>
          </button>
        )}
        <button onClick={props.retryMedia} aria-label="Reconnect call">
          <ArrowClockwise />
          <span>Reconnect</span>
        </button>
        <button
          className="end"
          onClick={props.endSession}
          disabled={props.ended}
        >
          <PhoneDisconnect />
          <span>End call</span>
        </button>
      </div>
    </div>
  );
}

export function StudentSessionView(
  props: CommonProps & {
    ratingOpen: boolean;
    rating: number;
    setRating: Dispatch<SetStateAction<number>>;
    submitRating: () => void;
    skipRating: () => void;
    onExit: () => void;
  },
) {
  const peerName = props.match?.peerLabel ?? "Bodhi-Mitra psychologist";
  const sessionState = props.paused ? "Paused" : props.ended ? "Ended" : "Live";
  return (
    <section className="role-session role-session--student student-chat-shell">
      <Toast text={props.toast} close={() => props.setToast("")} />
      <header className="student-session-head student-chat-head">
        <button
          className="student-chat-head__back"
          type="button"
          onClick={props.onExit}
          aria-label="Back to my sessions"
        >
          <ArrowLeft />
        </button>
        <div className="student-session-head__identity">
          <span>
            {peerName[0]}
            <i />
          </span>
          <div>
            <small>Private support session</small>
            <strong>{peerName}</strong>
          </div>
        </div>
        <div className="student-session-head__status">
          <span>
            <LockKey weight="fill" /> Identity protected
          </span>
          <b className={`is-${sessionState.toLowerCase()}`}>
            {sessionState}
            {!props.ended && !props.paused ? `  ${props.time}` : ""}
          </b>
        </div>
        <div className="student-session-head__actions">
          <button onClick={props.escalate} className="safety">
            <WarningCircle />
            <span>I feel unsafe</span>
          </button>
          <button onClick={props.endSession} disabled={props.ended}>
            <PhoneDisconnect />
            <span>End session</span>
          </button>
        </div>
      </header>
      {props.paused && (
        <div className="student-pause">
          <Pause weight="fill" />
          <div>
            <strong>Take all the time you need.</strong>
            <span>Your psychologist will know that you need a moment.</span>
          </div>
          <Button onClick={() => props.setPaused(false)}>
            <Play weight="fill" /> Resume
          </Button>
        </div>
      )}
      <div className="student-session-layout student-chat-layout">
        <aside
          className="student-care-rail student-chat-rail"
          aria-label="Session support tools"
        >
          <div className="student-care-card">
            <Sparkle weight="fill" />
            <h2>This space is yours.</h2>
            <p>
              Share only what feels comfortable. A short sentence is enough to
              begin.
            </p>
          </div>
          <button
            className="student-pause-button"
            onClick={() => props.setPaused(true)}
            disabled={props.paused || props.ended}
          >
            <Pause />
            <span>I need a moment</span>
          </button>
          <div className="student-privacy-note">
            <ShieldCheck weight="duotone" />
            <div>
              <strong>Your privacy</strong>
              <p>Your identity is protected during this session.</p>
            </div>
          </div>
          <div className="student-chat-rail__help">
            <WarningCircle />
            <div>
              <strong>Need urgent help?</strong>
              <p>Use “I feel unsafe” to alert the care team.</p>
            </div>
          </div>
        </aside>
        <main className="role-chat student-chat-panel">
          {props.match?.mode && props.match.mode !== "chat" ? (
            <CallStage {...props} />
          ) : (
            <>
              <div className="student-chat-panel__top">
                <div>
                  <ChatCircleDots weight="duotone" />
                  <span>
                    <strong>Conversation</strong>
                    <small>Your psychologist is ready to listen</small>
                  </span>
                </div>
                <span>
                  <ShieldCheck weight="fill" /> Secure
                </span>
              </div>
              <MessageList
                messages={props.messages}
                bottom={props.bottom}
                emptyTitle="Begin when you feel ready"
                emptyBody="You do not need the perfect words. Tell us what feels most important right now."
                student
              />
              <Composer
                {...props}
                replies={studentReplies}
                disabled={props.ended}
                placeholder="Write what is on your mind..."
                student
              />
            </>
          )}
        </main>
      </div>
      {props.ratingOpen && (
        <div className="student-modal-backdrop">
          <div className="student-modal role-rating">
            <Star weight="duotone" />
            <span>Session complete</span>
            <h2>How supported did you feel?</h2>
            <p>Your feedback helps us improve student care.</p>
            <div className="role-rating__stars">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  className={value <= props.rating ? "active" : ""}
                  onClick={() => props.setRating(value)}
                  key={value}
                  aria-label={`${value} stars`}
                >
                  <Star weight={value <= props.rating ? "fill" : "regular"} />
                </button>
              ))}
            </div>
            <div className="role-rating__actions">
              <Button variant="secondary" onClick={props.skipRating}>
                Skip
              </Button>
              <Button disabled={!props.rating} onClick={props.submitRating}>
                Submit feedback
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function PsychologistSessionView(
  props: CommonProps & { onExit: () => void },
) {
  const [notes, setNotes] = useState("");
  return (
    <section className="role-session role-session--psychologist">
      <Toast text={props.toast} close={() => props.setToast("")} />
      <header className="clinician-session-head">
        <div className="clinician-session-head__title">
          <button
            className="clinician-session-back"
            type="button"
            onClick={props.onExit}
            aria-label="Back to psychologist sessions"
          >
            <ArrowLeft />
          </button>
          <div>
            <span className="clinician-live">
              <i /> {props.ended ? "Session ended" : "Active session"}
            </span>
            <h1>Support workspace</h1>
            <p>
              Session {props.sessionId.slice(0, 8)} · {props.time}
            </p>
          </div>
        </div>
        <div className="clinician-session-head__actions">
          <button onClick={props.saveTranscript}>
            <DownloadSimple /> Save locally
          </button>
          <button onClick={props.escalate} className="escalate">
            <Warning /> Escalate safety
          </button>
          {props.ended ? (
            <button className="end" onClick={props.onExit}>
              <ArrowLeft /> Return to sessions
            </button>
          ) : (
            <button className="end" onClick={props.endSession}>
              <PhoneDisconnect /> End session
            </button>
          )}
        </div>
      </header>
      <div className="clinician-layout">
        <aside className="clinician-context">
          <section>
            <header>
              <UserCircle weight="duotone" />
              <div>
                <small>Anonymous student</small>
                <strong>
                  {props.match?.peerLabel ?? "Student identity shielded"}
                </strong>
              </div>
            </header>
            <dl>
              <div>
                <dt>Mode</dt>
                <dd>{props.match?.mode ?? "Chat"}</dd>
              </div>
              <div>
                <dt>Shared mood</dt>
                <dd>{props.match?.mood ?? "Not shared"}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd className={props.match?.urgent ? "urgent" : ""}>
                  {props.match?.urgent ? "Urgent" : "Standard"}
                </dd>
              </div>
            </dl>
          </section>
          <section className="clinician-guidance">
            <Pulse weight="duotone" />
            <h2>Session guidance</h2>
            <ul>
              <li>Lead with validation and open questions.</li>
              <li>Check immediate safety when appropriate.</li>
              <li>Allow silence without rushing the student.</li>
            </ul>
          </section>
          <section className="clinician-notes">
            <div>
              <NotePencil />
              <h2>Private scratchpad</h2>
            </div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              maxLength={1200}
              placeholder="Temporary notes for this conversation…"
            />
            <small>
              <Info /> Not saved or transmitted. Cleared when you leave.
            </small>
          </section>
        </aside>
        <main className="role-chat role-chat--clinician">
          {props.match?.mode && props.match.mode !== "chat" ? (
            <CallStage {...props} psychologist />
          ) : (
            <>
              <div className="clinician-chat-label">
                <div>
                  <ChatCircleDots />
                  <span>
                    <strong>Live conversation</strong>
                    <small>Respond with care and clarity</small>
                  </span>
                </div>
                <span>
                  <ShieldCheck /> Verified professional
                </span>
              </div>
              <MessageList
                messages={props.messages}
                bottom={props.bottom}
                emptyTitle="The student has joined"
                emptyBody="Begin with a calm welcome and let them set the pace."
                psychologist
              />
              <Composer
                {...props}
                replies={clinicianReplies}
                disabled={props.ended}
                placeholder="Write a supportive response…"
              />
            </>
          )}
        </main>
      </div>
    </section>
  );
}
