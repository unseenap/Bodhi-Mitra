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

type Ack = (result: { ok: boolean; message?: string }) => void;
type SocketAuth = { id: string; role: "student" | "psychologist" | "admin" };
const timers = new Map<string, NodeJS.Timeout>();

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

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    maxHttpBufferSize: 64 * 1024,
    perMessageDeflate: false
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
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: messageOf(error) });
      }
    });

    socket.on(SOCKET_EVENTS.SESSION_READY, async (payload, ack?: Ack) => {
      try {
        const { sessionId } = sessionIdSchema.parse(payload);
        if (!socket.rooms.has(`session:${sessionId}`) || !await activeParticipant(sessionId, id)) throw new Error("Active session not found");
        socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SESSION_READY, { role });
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
        const session = await Session.findOneAndUpdate({ _id: candidate._id, endedAt: { $exists: false } }, { endedAt: new Date() });
        if (!session) throw new Error("Session has already ended");
        await EmergencyRequest.findByIdAndUpdate(session.requestId, { status: "ended" });
        io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SESSION_END, { sessionId });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: messageOf(error) });
      }
    });

    socket.on("disconnect", () => {
      if (role !== "psychologist") return;
      setTimeout(async () => {
        const connections = await io.in(`psychologist:${id}`).fetchSockets();
        if (!connections.length) await User.findByIdAndUpdate(id, { isOnline: false });
      }, 250).unref();
    });
  });
  return io;
}
