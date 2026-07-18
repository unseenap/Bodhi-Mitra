import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { SOCKET_EVENTS, type SessionMatch } from "@bodhi/shared";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { PsychologistSessionView, StudentSessionView, type SessionMessage } from "./SessionRoleViews";
import { buildIceServers, mediaConstraints, mediaFailureMessage } from "./webrtc";

type MatchContext = SessionMatch & { mood?: string; urgent?: boolean };
type Ack = { ok: boolean; message?: string };
type SessionSignal = { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

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
  const [mediaRevision, setMediaRevision] = useState(0);
  const [remotePlaybackBlocked, setRemotePlaybackBlocked] = useState(false);
  const [remoteAudioReady, setRemoteAudioReady] = useState(false);
  const [callStatus, setCallStatus] = useState<"connecting" | "connected" | "reconnecting" | "failed">("connecting");
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const offerStarted = useRef(false);
  const remoteReady = useRef(false);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const earlySignals = useRef<SessionSignal[]>([]);
  const mediaGeneration = useRef(0);
  const readyHandler = useRef<(() => void) | null>(null);
  const signalHandler = useRef<((payload: { signal: SessionSignal }) => void) | null>(null);
  const reconnectTimer = useRef<number | null>(null);

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
    let disposed = false;
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
      if (disposed) return;
      if (timeoutError || !result?.ok) {
        setSessionError(result?.message ?? "The session could not be joined. Please return to your dashboard and reconnect.");
        return;
      }
      setSessionError("");
      if (match.mode !== "chat") {
        const mediaReady = await setupMedia(socket);
        if (!disposed && mediaReady) socket.emit(SOCKET_EVENTS.SESSION_READY, { sessionId });
      } else socket.emit(SOCKET_EVENTS.SESSION_READY, { sessionId });
    });

    return () => {
      disposed = true;
      socket.off(SOCKET_EVENTS.SESSION_MESSAGE, receive);
      socket.off(SOCKET_EVENTS.SESSION_END, sessionEnded);
      socket.off("connect_error", connectError);
      stopMedia(socket);
    };
  }, [sessionId, isPsychologist, match?.mode, match?.ended, mediaRevision]);

  useEffect(() => {
    if (ended || match?.mode === "chat") return;
    const protectActiveCall = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", protectActiveCall);
    return () => window.removeEventListener("beforeunload", protectActiveCall);
  }, [ended, match?.mode]);

  function stopMedia(socket = getSocket()) {
    mediaGeneration.current += 1;
    if (readyHandler.current) socket.off(SOCKET_EVENTS.SESSION_READY, readyHandler.current);
    if (signalHandler.current) socket.off(SOCKET_EVENTS.SESSION_SIGNAL, signalHandler.current);
    readyHandler.current = null;
    signalHandler.current = null;
    if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current);
    reconnectTimer.current = null;
    peerConnection.current?.close();
    peerConnection.current = null;
    const stream = localVideo.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    offerStarted.current = false;
    remoteReady.current = false;
    pendingCandidates.current = [];
    earlySignals.current = [];
  }

  async function setupMedia(socket: ReturnType<typeof getSocket>) {
    const generation = ++mediaGeneration.current;
    offerStarted.current = false;
    remoteReady.current = false;
    pendingCandidates.current = [];
    earlySignals.current = [];
    setMediaError("");
    setRemotePlaybackBlocked(false);
    setRemoteAudioReady(false);
    setCallStatus("connecting");

    const sendSignal = (signal: SessionSignal) => {
      socket.timeout(6_000).emit(SOCKET_EVENTS.SESSION_SIGNAL, { sessionId, signal }, (timeoutError: Error | null, result?: Ack) => {
        if (!timeoutError && result?.ok) return;
        setCallStatus("failed");
        setMediaError(result?.message ?? "Call signaling did not reach the server. Check your connection and retry.");
      });
    };

    const createOffer = async (iceRestart = false) => {
      const peer = peerConnection.current;
      if (!isPsychologist || !peer || (offerStarted.current && !iceRestart) || peer.signalingState !== "stable") return;
      offerStarted.current = true;
      try {
        const offer = await peer.createOffer({ iceRestart });
        await peer.setLocalDescription(offer);
        sendSignal({ sdp: { type: offer.type, sdp: offer.sdp } });
      } catch {
        offerStarted.current = false;
        setCallStatus("failed");
        setMediaError("The secure call could not be started. Check your connection and try again.");
      }
    };

    const applySignal = async (signal: SessionSignal) => {
      const peer = peerConnection.current;
      if (!peer || generation !== mediaGeneration.current) return;
      try {
        if (signal.sdp) {
          if (signal.sdp.type === "offer" && peer.signalingState !== "stable") {
            await peer.setLocalDescription({ type: "rollback" });
          }
          await peer.setRemoteDescription(signal.sdp);
          for (const candidate of pendingCandidates.current.splice(0)) await peer.addIceCandidate(candidate);
          if (signal.sdp.type === "offer") {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            sendSignal({ sdp: { type: answer.type, sdp: answer.sdp } });
          }
        } else if (signal.candidate) {
          if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate);
          else pendingCandidates.current.push(signal.candidate);
        }
      } catch {
        setMediaError("The secure call negotiation was interrupted. Use Retry call to reconnect.");
        setCallStatus("failed");
      }
    };

    const receiveReady = () => {
      remoteReady.current = true;
      if (isPsychologist) void createOffer();
      else socket.emit(SOCKET_EVENTS.SESSION_READY, { sessionId });
    };
    const receiveSignal = ({ signal }: { signal: SessionSignal }) => {
      if (!peerConnection.current) earlySignals.current.push(signal);
      else void applySignal(signal);
    };
    readyHandler.current = receiveReady;
    signalHandler.current = receiveSignal;
    socket.on(SOCKET_EVENTS.SESSION_READY, receiveReady);
    socket.on(SOCKET_EVENTS.SESSION_SIGNAL, receiveSignal);

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Media devices are unavailable");
      const relayRequest = api<{ iceServers: RTCIceServer[] }>(`/sessions/${sessionId}/ice-config`).catch(() => ({ iceServers: [] }));
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(match?.mode ?? "voice"));
      if (generation !== mediaGeneration.current) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }
      setMuted(false);
      setCameraOff(false);
      if (localVideo.current) localVideo.current.srcObject = stream;
      const localIceServers = buildIceServers({
        stunUrl: import.meta.env.VITE_STUN_URL,
        turnUrl: import.meta.env.VITE_TURN_URL,
        turnUsername: import.meta.env.VITE_TURN_USERNAME,
        turnCredential: import.meta.env.VITE_TURN_CREDENTIAL
      });
      const relay = await relayRequest;
      const iceServers = [...localIceServers, ...relay.iceServers];
      const peer = new RTCPeerConnection({ iceServers });
      peerConnection.current = peer;
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      peer.ontrack = event => {
        const media = remoteVideo.current;
        if (!media) return;
        const remoteStream = media.srcObject instanceof MediaStream ? media.srcObject : (event.streams[0] ?? new MediaStream());
        if (!remoteStream.getTracks().some(track => track.id === event.track.id)) remoteStream.addTrack(event.track);
        media.srcObject = remoteStream;
        media.muted = false;
        media.volume = 1;
        event.track.enabled = true;
        if (event.track.kind === "audio") setRemoteAudioReady(true);
        const playRemote = () => void media.play().then(() => setRemotePlaybackBlocked(false)).catch(() => setRemotePlaybackBlocked(true));
        event.track.onunmute = playRemote;
        media.onloadedmetadata = playRemote;
        playRemote();
      };
      peer.onicecandidate = event => {
        if (event.candidate && generation === mediaGeneration.current) sendSignal({ candidate: event.candidate.toJSON() });
      };
      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        setCallStatus(state === "connected" ? "connected" : state === "failed" ? "failed" : state === "disconnected" ? "reconnecting" : "connecting");
        if (state === "connected") {
          setMediaError("");
          offerStarted.current = false;
        }
        if (state === "disconnected" && isPsychologist) {
          if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current);
          reconnectTimer.current = window.setTimeout(() => void createOffer(true), 2500);
        }
        if (state === "failed") setMediaError("The call connection failed. Use Retry call, or continue with campus telephone support.");
      };
      peer.onicecandidateerror = () => setCallStatus(current => current === "connected" ? current : "reconnecting");

      for (const signal of earlySignals.current.splice(0)) await applySignal(signal);
      if (remoteReady.current && isPsychologist) await createOffer();
      return true;
    } catch (error) {
      setCallStatus("failed");
      setMediaError(mediaFailureMessage(error));
      return false;
    }
  }

  function retryMedia() {
    stopMedia();
    setMediaRevision(value => value + 1);
  }

  function resumeRemoteAudio() {
    void remoteVideo.current?.play().then(() => setRemotePlaybackBlocked(false)).catch(() => setMediaError("Audio playback is still blocked by the browser. Check this site's sound permission."));
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
    else setToast("No active microphone was found. Retry the call after checking permissions.");
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
    muted, cameraOff, toggleAudio, toggleVideo, mediaError, callStatus,
    retryMedia, remotePlaybackBlocked, remoteAudioReady, resumeRemoteAudio
  };

  return isPsychologist
    ? <PsychologistSessionView {...shared} onExit={() => navigate("/psychologist/sessions")} />
    : <StudentSessionView {...shared} ratingOpen={ratingOpen} rating={rating} setRating={setRating} submitRating={submitRating} skipRating={() => navigate("/student/session")} />;
}
