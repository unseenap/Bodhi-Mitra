import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server, type Socket } from "socket.io";
import {
  emergencyIdSchema,
  emergencyRequestSchema,
  sessionIdSchema,
  sessionMessageSchema,
  sessionSignalSchema,
  SOCKET_EVENTS
} from "@bodhi/shared";
import { env } from "../config/env.js";
import { EmergencyRequest } from "../models/EmergencyRequest.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { acceptEmergency, createEmergency, expireEmergency, hotlines } from "../services/emergency.service.js";
import { verifyToken } from "../utils/auth.js";
import { createNotification, createNotificationForRole, setNotificationEmitter } from "../services/notification.service.js";

type Ack = (result: { ok: boolean; message?: string }) => void;
type SocketAuth = { id: string; role: "student" | "psychologist" | "admin" };
const timers = new Map<string, NodeJS.Timeout>();
const disconnectedPresence = new Map<string, string>();
const joinedPresence = new Set<string>();

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed";
}

function socketRateLimit(socket: Socket, key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const buckets = (socket.data.rateLimits ??= new Map<string, { start: number; count: number }>()) as Map<string, { start: number; count: number }>;
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

async function activeParticipant(sessionId: string, userId: string) {
  return Session.findOne({
    sessionId,
    endedAt: { $exists: false },
    $or: [{ studentId: userId }, { psychologistId: userId }]
  }).select("+studentId");
}

function peerForSession(session: any, role: SocketAuth["role"]) {
  if (role === "student") return { id: String(session.psychologistId), role: "psychologist" as const };
  if (role === "psychologist") return { id: String(session.studentId), role: "student" as const };
  return null;
}

function sessionActionUrl(role: "student" | "psychologist", sessionId: string) {
  return `/${role}/session/${sessionId}`;
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    maxHttpBufferSize: 64 * 1024,
    perMessageDeflate: false
  });
  setNotificationEmitter((recipientId, payload) => {
    io.to(`student:${recipientId}`).to(`psychologist:${recipientId}`).to(`admin:${recipientId}`).emit("notification:new", payload);
  });

  io.use(async (socket, next) => {
    try {
      const token = typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : "";
      const claims = verifyToken(token);
      const user = await User.findOne({ _id: claims.sub, role: claims.role, isActive: true, verified: true }).select("role").lean();
      if (!user) return next(new Error("Authentication required"));
      socket.data.auth = { id: claims.sub, role: user.role } satisfies SocketAuth;
      next();
    } catch {
      next(new Error("Authentication required"));
    }
  });

  async function expireAndNotify(requestId: string) {
    const expired = await expireEmergency(requestId);
    if (!expired) return;
    io.to(`student:${String(expired.studentId)}`).emit(SOCKET_EVENTS.EMERGENCY_TIMEOUT, { hotlines });
    io.to("psychologists").emit(SOCKET_EVENTS.EMERGENCY_TAKEN, { requestId });
    await Promise.allSettled([
      createNotification({
        recipientId: String(expired.studentId), recipientRole: "student", type: "emergency.request.timeout",
        title: "Support options are ready", message: "Immediate support options are available.", priority: "critical",
        actionUrl: "/emergency", entityType: "EmergencyRequest", entityId: requestId,
        channels: ["in_app", "socket", "push"], deduplicationKey: `emergency-timeout:${requestId}`
      }),
      createNotificationForRole("admin", {
        type: "emergency.request.timeout", title: "Support request timed out",
        message: "A support request reached the response timeout.", priority: "high", actionUrl: "/admin/reports",
        entityType: "EmergencyRequest", entityId: requestId, channels: ["in_app", "socket", "push"],
        deduplicationKey: recipientId => `emergency-timeout:${requestId}:${recipientId}`
      })
    ]);
  }

  // Recover timeout delivery after a process restart. The database remains the
  // source of truth, so duplicate workers cannot expire the same request twice.
  const sweep = setInterval(async () => {
    try {
      const overdue = await EmergencyRequest.find({ status: "pending", timeoutAt: { $lte: new Date() } }).select("_id").limit(100).lean();
      await Promise.all(overdue.map(request => expireAndNotify(String(request._id))));
    } catch (error) {
      console.error("Emergency timeout sweep failed", error);
    }
  }, 5_000);
  sweep.unref();

  io.on("connection", async socket => {
    const { id, role } = socket.data.auth as SocketAuth;
    socket.join(`${role}:${id}`);
    if (role === "psychologist") {
      socket.join("psychologists");
      await User.findByIdAndUpdate(id, { isOnline: true });
    }

    socket.on(SOCKET_EVENTS.EMERGENCY_REQUEST, async (payload, ack?: Ack) => {
      try {
        if (role !== "student") throw new Error("Student access required");
        if (!socketRateLimit(socket, "emergency-request", 3, 60_000)) throw new Error("Please wait before sending another emergency request");
        const { mode, mood, urgent } = emergencyRequestSchema.strict().parse(payload);
        const request = await createEmergency(id, mode, { mood, urgent });
        const safe = { requestId: request.id, anonId: request.anonId, mode: request.mode, mood: request.mood, urgent: request.urgent, waitStartedAt: request.createdAt.toISOString() };
        socket.emit(SOCKET_EVENTS.EMERGENCY_QUEUED, safe);
        io.to("psychologists").emit(SOCKET_EVENTS.EMERGENCY_NEW, safe);
        await Promise.allSettled([
          createNotification({
            recipientId: id, recipientRole: "student", type: "emergency.request.created",
            title: "Support request received", message: "We are finding an available psychologist for you.",
            actionUrl: "/student", entityType: "EmergencyRequest", entityId: request.id,
            deduplicationKey: `emergency-created:${request.id}`
          }),
          createNotificationForRole("psychologist", {
            type: request.urgent ? "emergency.request.urgent" : "emergency.request.created",
            title: request.urgent ? "Urgent support request" : "New support request",
            message: `A student is waiting for ${request.mode} support.`, priority: "critical", actionUrl: "/psychologist",
            entityType: "EmergencyRequest", entityId: request.id, channels: ["in_app", "socket", "push"],
            deduplicationKey: recipientId => `emergency-new:${request.id}:${recipientId}`
          }, { isAvailable: true })
        ]);
        const timer = setTimeout(async () => {
          try { await expireAndNotify(request.id); }
          finally { timers.delete(request.id); }
        }, env.REQUEST_TIMEOUT_SECONDS * 1000);
        timers.set(request.id, timer);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: messageOf(error) });
      }
    });

    socket.on(SOCKET_EVENTS.EMERGENCY_ACCEPT, async (payload, ack?: Ack) => {
      try {
        if (role !== "psychologist") throw new Error("Psychologist access required");
        if (!socketRateLimit(socket, "emergency-accept", 20, 60_000)) throw new Error("Too many acceptance attempts. Please wait a moment");
        const { requestId } = emergencyIdSchema.parse(payload);
        const result = await acceptEmergency(requestId, id);
        if (!result) return ack?.({ ok: false, message: "This request was already taken or expired" });
        const timer = timers.get(requestId);
        if (timer) clearTimeout(timer);
        timers.delete(requestId);
        const match = { sessionId: result.session.sessionId, mode: result.request.mode, mood: result.request.mood, urgent: result.request.urgent, peerLabel: result.request.anonId };
        io.to(`student:${String(result.request.studentId)}`).emit(SOCKET_EVENTS.SESSION_MATCHED, { ...match, peerLabel: "Bodhi-Mitra psychologist" });
        socket.emit(SOCKET_EVENTS.SESSION_MATCHED, match);
        io.to("psychologists").emit(SOCKET_EVENTS.EMERGENCY_TAKEN, { requestId });
        await Promise.allSettled([
          createNotification({
            recipientId: String(result.request.studentId), recipientRole: "student", type: "emergency.request.matched",
            title: "A psychologist is ready", message: "Your private support session is ready to open.", priority: "critical",
            actionUrl: `/student/session/${result.session.sessionId}`, entityType: "Session", entityId: result.session.sessionId,
            channels: ["in_app", "socket", "push"], deduplicationKey: `emergency-matched:${requestId}`
          }),
          createNotification({
            recipientId: id, recipientRole: "psychologist", type: "session.created", title: "Private session ready",
            message: "The secure support session is ready to open.", priority: "high",
            actionUrl: `/psychologist/session/${result.session.sessionId}`, entityType: "Session", entityId: result.session.sessionId,
            deduplicationKey: `session-created:${result.session.sessionId}`
          })
        ]);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: messageOf(error) });
      }
    });

    socket.on(SOCKET_EVENTS.EMERGENCY_CANCEL, async (payload, ack?: Ack) => {
      try {
        if (role !== "student") throw new Error("Student access required");
        const { requestId } = emergencyIdSchema.parse(payload);
        const cancelled = await EmergencyRequest.findOneAndUpdate(
          { _id: requestId, studentId: id, status: "pending" },
          { status: "cancelled" }
        );
        const timer = timers.get(requestId);
        if (timer) clearTimeout(timer);
        timers.delete(requestId);
        if (cancelled) io.to("psychologists").emit(SOCKET_EVENTS.EMERGENCY_TAKEN, { requestId });
        ack?.({ ok: Boolean(cancelled), ...(!cancelled ? { message: "The request could not be cancelled" } : {}) });
      } catch (error) {
        ack?.({ ok: false, message: messageOf(error) });
      }
    });

    socket.on(SOCKET_EVENTS.SESSION_JOIN, async (payload, ack?: Ack) => {
      try {
        const { sessionId } = sessionIdSchema.parse(payload);
        const session = await activeParticipant(sessionId, id);
        if (!session) throw new Error("Active session not found");
        await socket.join(`session:${sessionId}`);
        socket.data.activeSessionId = sessionId;
        const peer = peerForSession(session, role);
        if (peer) {
          const presenceKey = `${sessionId}:${role}`;
          const disconnectedToken = disconnectedPresence.get(presenceKey);
          const isFirstJoin = !joinedPresence.has(presenceKey);
          joinedPresence.add(presenceKey);
          const event = disconnectedToken ? SOCKET_EVENTS.SESSION_PARTICIPANT_RECONNECTED : SOCKET_EVENTS.SESSION_PARTICIPANT_JOINED;
          const type = disconnectedToken ? "session.connection.restored" : "session.participant.joined";
          const title = disconnectedToken ? "Session connection restored" : role === "student" ? "Student joined" : "Psychologist joined";
          const message = disconnectedToken
            ? "The secure session connection has been restored."
            : role === "student" ? "The student has joined the private session." : "Your psychologist has joined the private session.";
          disconnectedPresence.delete(presenceKey);
          if (disconnectedToken || isFirstJoin) {
            io.to(`${peer.role}:${peer.id}`).emit(event, { sessionId, role });
            await createNotification({
              recipientId: peer.id, recipientRole: peer.role, type, title, message,
              priority: disconnectedToken ? "normal" : "high", actionUrl: sessionActionUrl(peer.role, sessionId),
              entityType: "Session", entityId: sessionId,
              deduplicationKey: disconnectedToken ? `session-reconnected:${sessionId}:${role}:${disconnectedToken}` : `session-joined:${sessionId}:${role}`
            });
          }
        }
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: messageOf(error) });
      }
    });

    socket.on(SOCKET_EVENTS.SESSION_READY, async (payload, ack?: Ack) => {
      try {
        const { sessionId } = sessionIdSchema.parse(payload);
        const session = await activeParticipant(sessionId, id);
        if (!socket.rooms.has(`session:${sessionId}`) || !session) throw new Error("Active session not found");
        socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SESSION_READY, { role });
        if (role === "psychologist" && session.mode !== "chat") {
          const studentId = String(session.studentId);
          io.to(`student:${studentId}`).emit(SOCKET_EVENTS.SESSION_CALL_READY, { sessionId, mode: session.mode });
          await createNotification({
            recipientId: studentId, recipientRole: "student", type: "session.call.incoming",
            title: `Secure ${session.mode} call ready`, message: "Your psychologist is ready to connect securely.",
            priority: "critical", actionUrl: `/student/session/${sessionId}`, entityType: "Session", entityId: sessionId,
            channels: ["in_app", "socket", "push"], deduplicationKey: `session-call-ready:${sessionId}`
          });
        }
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: messageOf(error) });
      }
    });

    socket.on(SOCKET_EVENTS.SESSION_MESSAGE, async (payload, ack?: Ack) => {
      try {
        if (!socketRateLimit(socket, "session-message", 60, 60_000)) throw new Error("Messages are being sent too quickly");
        const { sessionId, body } = sessionMessageSchema.parse(payload);
        if (!socket.rooms.has(`session:${sessionId}`) || !await activeParticipant(sessionId, id)) throw new Error("Active session not found");
        const message = { id: randomUUID(), body, sentAt: new Date().toISOString(), sender: role };
        socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SESSION_MESSAGE, message);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: messageOf(error) });
      }
    });

    socket.on(SOCKET_EVENTS.SESSION_SIGNAL, async (payload, ack?: Ack) => {
      try {
        if (!socketRateLimit(socket, "session-signal", 180, 60_000)) throw new Error("Call signaling limit reached");
        const { sessionId, signal } = sessionSignalSchema.parse(payload);
        if (!socket.rooms.has(`session:${sessionId}`) || !await activeParticipant(sessionId, id)) throw new Error("Active session not found");
        socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SESSION_SIGNAL, { signal, sender: role });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: messageOf(error) });
      }
    });

    socket.on(SOCKET_EVENTS.SESSION_END, async (payload, ack?: Ack) => {
      try {
        const { sessionId } = sessionIdSchema.parse(payload);
        const candidate = await activeParticipant(sessionId, id);
        if (!candidate) throw new Error("Active session not found");
        const session = await Session.findOneAndUpdate({ _id: candidate._id, endedAt: { $exists: false } }, { endedAt: new Date() }).select("+studentId");
        if (!session) throw new Error("Session has already ended");
        await EmergencyRequest.findByIdAndUpdate(session.requestId, { status: "ended" });
        for (const participantRole of ["student", "psychologist"] as const) {
          joinedPresence.delete(`${sessionId}:${participantRole}`);
          disconnectedPresence.delete(`${sessionId}:${participantRole}`);
        }
        io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SESSION_END, { sessionId });
        await Promise.allSettled([
          createNotification({
            recipientId: String(session.studentId), recipientRole: "student", type: "session.ended",
            title: "Session ended", message: "Your private support session has ended. You can now share feedback.", priority: "high",
            actionUrl: `/student/session/${sessionId}`, entityType: "Session", entityId: sessionId,
            deduplicationKey: `session-ended:${sessionId}:student`
          }),
          createNotification({
            recipientId: String(session.psychologistId), recipientRole: "psychologist", type: "session.ended",
            title: "Session completed", message: "The private support session has ended.", priority: "high",
            actionUrl: "/psychologist/sessions", entityType: "Session", entityId: sessionId,
            deduplicationKey: `session-ended:${sessionId}:psychologist`
          })
        ]);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: messageOf(error) });
      }
    });

    socket.on("disconnect", () => {
      const activeSessionId = typeof socket.data.activeSessionId === "string" ? socket.data.activeSessionId : null;
      if (activeSessionId && role !== "admin") {
        setTimeout(async () => {
          try {
            const activeConnections = await io.in(`${role}:${id}`).fetchSockets();
            const stillPresent = activeConnections.some(connection => connection.rooms.has(`session:${activeSessionId}`));
            if (stillPresent) return;
            const session = await activeParticipant(activeSessionId, id);
            const peer = session ? peerForSession(session, role) : null;
            if (!session || !peer) return;
            const token = randomUUID();
            joinedPresence.delete(`${activeSessionId}:${role}`);
            disconnectedPresence.set(`${activeSessionId}:${role}`, token);
            io.to(`${peer.role}:${peer.id}`).emit(SOCKET_EVENTS.SESSION_PARTICIPANT_DISCONNECTED, { sessionId: activeSessionId, role });
            await createNotification({
              recipientId: peer.id, recipientRole: peer.role, type: "session.participant.disconnected",
              title: "Session connection interrupted", message: "The other participant disconnected. The session remains protected while they reconnect.",
              priority: "high", actionUrl: sessionActionUrl(peer.role, activeSessionId), entityType: "Session", entityId: activeSessionId,
              deduplicationKey: `session-disconnected:${activeSessionId}:${role}:${token}`,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });
          } catch (error) {
            console.error("Session presence update failed", error);
          }
        }, 1_000).unref();
      }
      if (role !== "psychologist") return;
      setTimeout(async () => {
        const connections = await io.in(`psychologist:${id}`).fetchSockets();
        if (!connections.length) await User.findByIdAndUpdate(id, { isOnline: false });
      }, 250).unref();
    });
  });
  return io;
}
