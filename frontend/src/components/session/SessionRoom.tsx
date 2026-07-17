import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { SOCKET_EVENTS, type SessionMatch } from "@bodhi/shared";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { PsychologistSessionView, StudentSessionView, type SessionMessage } from "./SessionRoleViews";

type MatchContext = SessionMatch & { mood?: string; urgent?: boolean };
type Ack = { ok: boolean; message?: string };

export function SessionRoom() {
  const { sessionId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const routeMatch = location.state as MatchContext | undefined;
  const isPsychologist = user?.role === "psychologist";
  const [match, setMatch] = useState<MatchContext | null>(routeMatch ?? null);
  const [loadingSession, setLoadingSession] = useState(!routeMatch);
  const [sessionError, setSessionError] = useState("");
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [ended, setEnded] = useState(Boolean(routeMatch?.ended));
  const [toast, setToast] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [callStatus, setCallStatus] = useState<"connecting" | "connected" | "reconnecting" | "failed">("connecting");
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const offerStarted = useRef(false);
  const studentReadyEchoed = useRef(false);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    let active = true;
    setLoadingSession(true);
    api<{ session: MatchContext }>(`/sessions/${sessionId}`)
      .then(result => {
        if (!active) return;
        setMatch(current => ({ ...result.session, mood: current?.mood, urgent: current?.urgent }));
        setEnded(Boolean(result.session.ended));
        setSessionError("");
      })
      .catch(error => active && setSessionError((error as Error).message))
      .finally(() => active && setLoadingSession(false));
    return () => { active = false; };
  }, [sessionId]);

  useEffect(() => {
    if (ended) return;
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [ended]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sessionId || !match || match.ended) return;
    const socket = getSocket();
    const receive = (message: SessionMessage) => setMessages(current => [...current, message]);
    const sessionEnded = () => {
      setEnded(true);
      stopMedia();
      if (!isPsychologist) setRatingOpen(true);
    };
    const connectError = () => setSessionError("The secure connection was interrupted. Check your internet connection and try again.");

    socket.on(SOCKET_EVENTS.SESSION_MESSAGE, receive);
    socket.on(SOCKET_EVENTS.SESSION_END, sessionEnded);
    socket.on("connect_error", connectError);

    socket.timeout(8_000).emit(SOCKET_EVENTS.SESSION_JOIN, { sessionId }, async (timeoutError: Error | null, result?: Ack) => {
      if (timeoutError || !result?.ok) {
        setSessionError(result?.message ?? "The session could not be joined. Please return to your dashboard and reconnect.");
        return;
      }
      setSessionError("");
      if (match.mode !== "chat") await setupMedia(socket);
      socket.emit(SOCKET_EVENTS.SESSION_READY, { sessionId });
    });

    return () => {
      socket.off(SOCKET_EVENTS.SESSION_MESSAGE, receive);
      socket.off(SOCKET_EVENTS.SESSION_END, sessionEnded);
      socket.off(SOCKET_EVENTS.SESSION_SIGNAL);
      socket.off(SOCKET_EVENTS.SESSION_READY);
      socket.off("connect_error", connectError);
      stopMedia();
    };
  }, [sessionId, isPsychologist, match?.mode, match?.ended]);

  function stopMedia() {
    peerConnection.current?.close();
    peerConnection.current = null;
    const stream = localVideo.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  }

  async function setupMedia(socket: ReturnType<typeof getSocket>) {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Media devices are unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: match?.mode === "video" });
      if (localVideo.current) localVideo.current.srcObject = stream;
      const iceServers: RTCIceServer[] = [{ urls: import.meta.env.VITE_STUN_URL ?? "stun:stun.l.google.com:19302" }];
      if (import.meta.env.VITE_TURN_URL) {
        iceServers.push({
          urls: import.meta.env.VITE_TURN_URL,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL
        });
      }
      const peer = new RTCPeerConnection({ iceServers });
      peerConnection.current = peer;
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      peer.ontrack = event => { if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0]; };
      peer.onicecandidate = event => {
        if (event.candidate) socket.emit(SOCKET_EVENTS.SESSION_SIGNAL, { sessionId, signal: { candidate: event.candidate.toJSON() } });
      };
      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        setCallStatus(state === "connected" ? "connected" : state === "failed" ? "failed" : state === "disconnected" ? "reconnecting" : "connecting");
        if (state === "failed") setMediaError("The call connection failed. End the call and retry, or continue using emergency telephone support.");
      };

      const createOffer = async () => {
        if (!isPsychologist || offerStarted.current || peer.signalingState !== "stable") return;
        offerStarted.current = true;
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit(SOCKET_EVENTS.SESSION_SIGNAL, { sessionId, signal: { sdp: { type: offer.type, sdp: offer.sdp } } });
      };
      const receiveReady = () => {
        if (isPsychologist) void createOffer();
        else if (!studentReadyEchoed.current) {
          studentReadyEchoed.current = true;
          socket.emit(SOCKET_EVENTS.SESSION_READY, { sessionId });
        }
      };
      const receiveSignal = async ({ signal }: { signal: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit } }) => {
        try {
          if (signal.sdp) {
            await peer.setRemoteDescription(signal.sdp);
            for (const candidate of pendingCandidates.current.splice(0)) await peer.addIceCandidate(candidate);
            if (signal.sdp.type === "offer") {
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              socket.emit(SOCKET_EVENTS.SESSION_SIGNAL, { sessionId, signal: { sdp: { type: answer.type, sdp: answer.sdp } } });
            }
          } else if (signal.candidate) {
            if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate);
            else pendingCandidates.current.push(signal.candidate);
          }
        } catch {
          setMediaError("The secure call negotiation was interrupted. Please check your connection and try again.");
        }
      };
      socket.on(SOCKET_EVENTS.SESSION_READY, receiveReady);
      socket.on(SOCKET_EVENTS.SESSION_SIGNAL, receiveSignal);
    } catch {
      setCallStatus("failed");
      setMediaError("Microphone or camera access was not granted. Check browser permissions, then reload this session.");
    }
  }

  function send() {
    const body = draft.trim();
    if (!body || ended) return;
    const optimisticId = crypto.randomUUID();
    setMessages(current => [...current, { id: optimisticId, body, sentAt: new Date().toISOString(), sender: user?.role ?? "me", own: true }]);
    setDraft("");
    getSocket().timeout(8_000).emit(SOCKET_EVENTS.SESSION_MESSAGE, { sessionId, body }, (timeoutError: Error | null, result?: Ack) => {
      if (timeoutError || !result?.ok) {
        setMessages(current => current.filter(message => message.id !== optimisticId));
        setDraft(body);
        setToast(result?.message ?? "Message not delivered. Please check your connection and try again.");
      }
    });
  }

  function submit(event: FormEvent) { event.preventDefault(); send(); }
  function handleKeys(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); }
  }
  function endSession() {
    if (ended) return;
    getSocket().timeout(8_000).emit(SOCKET_EVENTS.SESSION_END, { sessionId }, (timeoutError: Error | null, result?: Ack) => {
      if (timeoutError || !result?.ok) setToast(result?.message ?? "Could not end the session. Please check your connection and retry.");
    });
  }
  function toggleAudio() {
    const track = (localVideo.current?.srcObject as MediaStream | null)?.getAudioTracks()[0];
    if (track) { track.enabled = muted; setMuted(!muted); }
  }
  function toggleVideo() {
    const track = (localVideo.current?.srcObject as MediaStream | null)?.getVideoTracks()[0];
    if (track) { track.enabled = cameraOff; setCameraOff(!cameraOff); }
  }
  function saveTranscript() {
    const text = messages.map(message => `[${new Date(message.sentAt).toLocaleTimeString()}] ${message.own ? "You" : message.sender}: ${message.body}`).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    link.download = `bodhi-session-${sessionId}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    setToast("Transcript saved only on this device");
  }
  async function escalate() {
    try { const result = await api<{ message: string }>(`/sessions/${sessionId}/escalate`, { method: "POST" }); setToast(result.message); }
    catch (error) { setToast((error as Error).message); }
  }
  async function submitRating() {
    if (!rating) return;
    try {
      await api(`/sessions/${sessionId}/rating`, { method: "POST", body: JSON.stringify({ rating }) });
      navigate("/student/session");
    } catch (error) { setToast((error as Error).message); }
  }

  if (loadingSession) return <main className="session-recovery" aria-live="polite"><div><span>Secure session</span><h1>Opening your private session</h1><p>Verifying access and reconnecting your conversation.</p><div className="session-recovery__pulse" /></div></main>;
  if (sessionError || !match) return <main className="session-recovery session-recovery--error"><div><span>Connection interrupted</span><h1>We could not open the conversation</h1><p>{sessionError || "This session is unavailable."}</p><nav><button onClick={() => window.location.reload()}>Try again</button><Link to={isPsychologist ? "/psychologist/sessions" : "/student"}>Return to dashboard</Link></nav></div></main>;

  const shared = {
    sessionId, match, messages, draft, setDraft, paused, setPaused, ended, toast, setToast,
    time: `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
    bottom, submit, handleKeys, endSession, saveTranscript, escalate, localVideo, remoteVideo,
    muted, cameraOff, toggleAudio, toggleVideo, mediaError, callStatus
  };

  return isPsychologist
    ? <PsychologistSessionView {...shared} onExit={() => navigate("/psychologist/sessions")} />
    : <StudentSessionView {...shared} ratingOpen={ratingOpen} rating={rating} setRating={setRating} submitRating={submitRating} skipRating={() => navigate("/student/session")} />;
}
