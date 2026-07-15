import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { SOCKET_EVENTS, type SessionMatch } from "@bodhi/shared";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { PsychologistSessionView, StudentSessionView, type SessionMessage } from "./SessionRoleViews";

type MatchContext = SessionMatch & { mood?: string; urgent?: boolean };

export function SessionRoom() {
  const { sessionId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const match = location.state as MatchContext | undefined;
  const isPsychologist = user?.role === "psychologist";
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [ended, setEnded] = useState(false);
  const [toast, setToast] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sessionId) return;
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.SESSION_JOIN, { sessionId });
    const receive = (message: SessionMessage) => setMessages(current => [...current, message]);
    const sessionEnded = () => { setEnded(true); if (!isPsychologist) setRatingOpen(true); };
    socket.on(SOCKET_EVENTS.SESSION_MESSAGE, receive);
    socket.on(SOCKET_EVENTS.SESSION_END, sessionEnded);
    if (match?.mode && match.mode !== "chat") void setupMedia(socket);
    return () => {
      socket.off(SOCKET_EVENTS.SESSION_MESSAGE, receive);
      socket.off(SOCKET_EVENTS.SESSION_END, sessionEnded);
      socket.off(SOCKET_EVENTS.SESSION_SIGNAL);
      peerConnection.current?.close();
      Array.from((localVideo.current?.srcObject as MediaStream | null)?.getTracks() ?? []).forEach(track => track.stop());
    };
  }, [sessionId, isPsychologist]);

  async function setupMedia(socket: ReturnType<typeof getSocket>) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: match?.mode === "video" });
      if (localVideo.current) localVideo.current.srcObject = stream;
      const iceServers: RTCIceServer[] = [{ urls: import.meta.env.VITE_STUN_URL ?? "stun:stun.l.google.com:19302" }];
      if (import.meta.env.VITE_TURN_URL) iceServers.push({ urls: import.meta.env.VITE_TURN_URL, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL });
      const peer = new RTCPeerConnection({ iceServers });
      peerConnection.current = peer;
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      peer.ontrack = event => { if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0]; };
      peer.onicecandidate = event => event.candidate && socket.emit(SOCKET_EVENTS.SESSION_SIGNAL, { sessionId, signal: { candidate: event.candidate } });
      const receiveSignal = async ({ signal }: { signal: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit } }) => {
        if (signal.sdp) {
          await peer.setRemoteDescription(signal.sdp);
          if (signal.sdp.type === "offer") {
            const answer = await peer.createAnswer(); await peer.setLocalDescription(answer);
            socket.emit(SOCKET_EVENTS.SESSION_SIGNAL, { sessionId, signal: { sdp: answer } });
          }
        } else if (signal.candidate) await peer.addIceCandidate(signal.candidate);
      };
      socket.on(SOCKET_EVENTS.SESSION_SIGNAL, receiveSignal);
      if (isPsychologist) {
        const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
        socket.emit(SOCKET_EVENTS.SESSION_SIGNAL, { sessionId, signal: { sdp: offer } });
      }
    } catch { setMediaError("Microphone or camera access was not granted. Check your browser permissions and try again."); }
  }

  function send() {
    const body = draft.trim();
    if (!body || ended) return;
    setMessages(current => [...current, { id: crypto.randomUUID(), body, sentAt: new Date().toISOString(), sender: user?.role ?? "me", own: true }]);
    getSocket().emit(SOCKET_EVENTS.SESSION_MESSAGE, { sessionId, body });
    setDraft("");
  }

  function submit(event: FormEvent) { event.preventDefault(); send(); }
  function handleKeys(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }
  function endSession() { if (ended) return; getSocket().emit(SOCKET_EVENTS.SESSION_END, { sessionId }); setEnded(true); if (!isPsychologist) setRatingOpen(true); }
  function toggleAudio() { const track = (localVideo.current?.srcObject as MediaStream | null)?.getAudioTracks()[0]; if (track) { track.enabled = muted; setMuted(!muted); } }
  function toggleVideo() { const track = (localVideo.current?.srcObject as MediaStream | null)?.getVideoTracks()[0]; if (track) { track.enabled = cameraOff; setCameraOff(!cameraOff); } }
  function saveTranscript() {
    const text = messages.map(message => `[${new Date(message.sentAt).toLocaleTimeString()}] ${message.own ? "You" : message.sender}: ${message.body}`).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); link.download = `bodhi-session-${sessionId}.txt`; link.click(); URL.revokeObjectURL(link.href);
    setToast("Transcript saved only on this device");
  }
  async function escalate() { try { await api(`/sessions/${sessionId}/escalate`, { method: "POST" }); setToast("Safety alert sent to the administration team"); } catch (error) { setToast((error as Error).message); } }
  async function submitRating() { if (rating) await api(`/sessions/${sessionId}/rating`, { method: "POST", body: JSON.stringify({ rating }) }); navigate(-1); }

  const shared = {
    sessionId, match, messages, draft, setDraft, paused, setPaused, ended, toast, setToast,
    time: `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
    bottom, submit, handleKeys, endSession, saveTranscript, escalate, localVideo, remoteVideo,
    muted, cameraOff, toggleAudio, toggleVideo, mediaError,
  };

  return isPsychologist
    ? <PsychologistSessionView {...shared} onExit={() => navigate("/psychologist/sessions")} />
    : <StudentSessionView {...shared} ratingOpen={ratingOpen} rating={rating} setRating={setRating} submitRating={submitRating} skipRating={() => navigate(-1)} />;
}
