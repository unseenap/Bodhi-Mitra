import { createHmac, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { MysqlAuditRepository, MysqlEmergencyRepository, MysqlSessionRepository } from "../repositories/mysql/index.js";
import { createNotification, createNotificationForRole } from "../services/notification.service.js";

const sessions = new MysqlSessionRepository();
const emergencies = new MysqlEmergencyRepository();
const audits = new MysqlAuditRepository();

export async function mysqlSessionDetails(req: Request, res: Response) {
  const sessionId = z.string().uuid().parse(req.params.sessionId);
  const session = await sessions.findParticipant(sessionId, req.auth!.id);
  if (!session) return res.status(404).json({ message: "Session not found" });
  const request = (await emergencies.listStudentHistory(session.studentId, 100)).find(row => row.id === session.requestId);
  res.json({ session: { sessionId: session.id, mode: session.mode, peerLabel: req.auth!.role === "psychologist" ? "Anonymous student" : "Bodhi-Mitra psychologist", mood: request?.mood, urgent: request?.urgent ?? false, ended: Boolean(session.endedAt), startedAt: session.startedAt } });
}
export async function mysqlSessionIceConfiguration(req: Request, res: Response) {
  const sessionId = z.string().uuid().parse(req.params.sessionId);
  if (!await sessions.findParticipant(sessionId, req.auth!.id, true)) return res.status(404).json({ message: "Active session not found" });
  if (!env.TURN_URL || !env.TURN_SHARED_SECRET) return res.json({ iceServers: [] });
  const expiresAt = Math.floor(Date.now() / 1000) + env.TURN_TTL_SECONDS;
  const username = `${expiresAt}:${req.auth!.id}`;
  const credential = createHmac("sha1", env.TURN_SHARED_SECRET).update(username).digest("base64");
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ iceServers: [{ urls: env.TURN_URL.split(",").map(x => x.trim()).filter(Boolean), username, credential }], expiresAt });
}
export async function mysqlRateSession(req: Request, res: Response) {
  const sessionId = z.string().uuid().parse(req.params.sessionId);
  const { rating, feedback } = z.object({ rating: z.number().int().min(1).max(5), feedback: z.string().trim().max(1000).optional() }).strict().parse(req.body);
  const existing = await sessions.findParticipant(sessionId, req.auth!.id);
  if (!existing) return res.status(404).json({ message: "Session not found" });
  if (!await sessions.saveFeedback(sessionId, req.auth!.id, rating, feedback)) return res.status(409).json({ message: "Feedback was already submitted or the session is still active" });
  if (rating <= 2) {
    await audits.create({ auditUuid: randomUUID(), action: "session.feedback_low", actorUuid: req.auth!.id, actorRole: "student", targetType: "Session", targetId: sessionId, metadata: { rating } });
    await createNotificationForRole("admin", { type: "session.feedback.low", title: "Session feedback needs review", message: "A low session rating requires attention.", priority: "high", actionUrl: "/admin/reports", entityType: "Session", entityId: sessionId, deduplicationKey: id => `session-feedback-low:${sessionId}:${id}` });
  }
  await createNotification({ recipientId: req.auth!.id, recipientRole: "student", type: "session.feedback.saved", title: "Feedback saved", message: "Thank you. Your session feedback was saved.", actionUrl: "/student/history", entityType: "Session", entityId: sessionId, deduplicationKey: `session-feedback-saved:${sessionId}` });
  res.json({ message: "Thank you for your feedback", feedback: { sessionId, rating, savedAt: new Date() } });
}
export async function mysqlEscalateSession(req: Request, res: Response) {
  const sessionId = z.string().uuid().parse(req.params.sessionId);
  if (!await sessions.findParticipant(sessionId, req.auth!.id, true)) return res.status(404).json({ message: "Active session not found" });
  await audits.create({ auditUuid: randomUUID(), action: "session.safety_escalated", actorUuid: req.auth!.id, actorRole: req.auth!.role, targetType: "Session", targetId: sessionId, metadata: { raisedAt: new Date().toISOString() } });
  await createNotificationForRole("admin", { type: "session.safety.escalated", title: "Safety alert requires attention", message: "A protected safety report requires immediate review.", priority: "critical", actionUrl: "/admin/reports", entityType: "Session", entityId: sessionId, channels: ["in_app", "socket", "push"], deduplicationKey: id => `session-safety:${sessionId}:${id}` });
  res.status(201).json({ message: "Safety alert sent to the administration team" });
}
