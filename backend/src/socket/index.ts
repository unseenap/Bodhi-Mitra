import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { emergencyRequestSchema, SOCKET_EVENTS } from "@bodhi/shared";
import { env } from "../config/env.js";
import { EmergencyRequest } from "../models/EmergencyRequest.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { acceptEmergency, createEmergency, expireEmergency, hotlines } from "../services/emergency.service.js";
import { verifyToken } from "../utils/auth.js";

const timers = new Map<string, NodeJS.Timeout>();
export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, { cors: { origin: env.CLIENT_URL, credentials: true } });
  io.use((socket, next) => { try { const claims = verifyToken(socket.handshake.auth.token); socket.data.auth = { id: claims.sub, role: claims.role }; next(); } catch { next(new Error("Authentication required")); } });
  io.on("connection", async socket => {
    const { id, role } = socket.data.auth as { id: string; role: string }; socket.join(`${role}:${id}`); if (role === "psychologist") { socket.join("psychologists"); await User.findByIdAndUpdate(id, { isOnline: true }); }
    socket.on(SOCKET_EVENTS.EMERGENCY_REQUEST, async (payload, ack) => {
      try { if (role !== "student") throw new Error("Student access required"); const { mode } = emergencyRequestSchema.parse(payload); const request = await createEmergency(id, mode); const safe = { requestId: request.id, anonId: request.anonId, mode: request.mode, waitStartedAt: request.createdAt.toISOString() }; socket.emit(SOCKET_EVENTS.EMERGENCY_QUEUED, safe); io.to("psychologists").emit(SOCKET_EVENTS.EMERGENCY_NEW, safe); timers.set(request.id, setTimeout(async () => { const expired = await expireEmergency(request.id); if (expired) { io.to(`student:${id}`).emit(SOCKET_EVENTS.EMERGENCY_TIMEOUT, { hotlines }); io.to("psychologists").emit(SOCKET_EVENTS.EMERGENCY_TAKEN, { requestId: request.id }); } timers.delete(request.id); }, env.REQUEST_TIMEOUT_SECONDS * 1000)); ack?.({ ok: true }); } catch (error) { ack?.({ ok: false, message: (error as Error).message }); }
    });
    socket.on(SOCKET_EVENTS.EMERGENCY_ACCEPT, async ({ requestId }, ack) => {
      try { if (role !== "psychologist") throw new Error("Psychologist access required"); const result = await acceptEmergency(requestId, id); if (!result) return ack?.({ ok: false, message: "This request was already taken or expired" }); const timer = timers.get(requestId); if (timer) clearTimeout(timer); timers.delete(requestId); const match = { sessionId: result.session.sessionId, anonToken: result.anonToken, mode: result.request.mode, peerLabel: result.request.anonId }; io.to(`student:${String(result.request.studentId)}`).emit(SOCKET_EVENTS.SESSION_MATCHED, { ...match, peerLabel: "Bodhi-Mitra psychologist" }); socket.emit(SOCKET_EVENTS.SESSION_MATCHED, match); io.to("psychologists").emit(SOCKET_EVENTS.EMERGENCY_TAKEN, { requestId }); ack?.({ ok: true }); } catch (error) { ack?.({ ok: false, message: (error as Error).message }); }
    });
    socket.on(SOCKET_EVENTS.EMERGENCY_CANCEL, async ({ requestId }, ack) => { if (role !== "student") return; const cancelled = await EmergencyRequest.findOneAndUpdate({ _id: requestId, studentId: id, status: "pending" }, { status: "cancelled" }); if (cancelled) io.to("psychologists").emit(SOCKET_EVENTS.EMERGENCY_TAKEN, { requestId }); ack?.({ ok: Boolean(cancelled) }); });
    socket.on(SOCKET_EVENTS.SESSION_JOIN, async ({ sessionId }) => { const session = await Session.findOne({ sessionId }).select("+studentId"); if (session && (String(session.studentId) === id || String(session.psychologistId) === id)) socket.join(`session:${sessionId}`); });
    socket.on(SOCKET_EVENTS.SESSION_MESSAGE, async payload => { const session = await Session.findOne({ sessionId: payload.sessionId }).select("+studentId"); if (session && (String(session.studentId) === id || String(session.psychologistId) === id)) socket.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.SESSION_MESSAGE, { id: randomUUID(), body: String(payload.body).slice(0, 4000), sentAt: new Date().toISOString(), sender: role }); });
    socket.on(SOCKET_EVENTS.SESSION_SIGNAL, payload => socket.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.SESSION_SIGNAL, { signal: payload.signal, sender: role }));
    socket.on(SOCKET_EVENTS.SESSION_END, async ({ sessionId }) => { const session = await Session.findOneAndUpdate({ sessionId, endedAt: null }, { endedAt: new Date() }); if (session) { await EmergencyRequest.findByIdAndUpdate(session.requestId, { status: "ended" }); io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SESSION_END, { sessionId }); } });
    socket.on("disconnect", async () => { if (role === "psychologist") await User.findByIdAndUpdate(id, { isOnline: false }); });
  });
  return io;
}
