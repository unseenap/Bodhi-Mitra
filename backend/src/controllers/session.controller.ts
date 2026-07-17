import type { Request, Response } from "express";
import { z } from "zod";
import { AuditLog } from "../models/AuditLog.js";
import { EmergencyRequest } from "../models/EmergencyRequest.js";
import { Session } from "../models/Session.js";

function participant(sessionId: string, userId: string) {
  return Session.findOne({
    sessionId,
    $or: [{ studentId: userId }, { psychologistId: userId }]
  }).select("+studentId");
}

export async function sessionDetails(req: Request, res: Response) {
  const sessionId = z.string().uuid().parse(req.params.sessionId);
  const session = await participant(sessionId, req.auth!.id);
  if (!session) return res.status(404).json({ message: "Session not found" });
  const request = await EmergencyRequest.findById(session.requestId).select("mood urgent").lean();

  res.json({
    session: {
      sessionId: session.sessionId,
      mode: session.mode,
      peerLabel: req.auth!.role === "psychologist" ? "Anonymous student" : "Bodhi-Mitra psychologist",
      mood: request?.mood,
      urgent: request?.urgent ?? false,
      ended: Boolean(session.endedAt),
      startedAt: session.startedAt
    }
  });
}

export async function rateSession(req: Request, res: Response) {
  const sessionId = z.string().uuid().parse(req.params.sessionId);
  const { rating, feedback } = z.object({
    rating: z.number().int().min(1).max(5),
    feedback: z.string().trim().max(1000).optional()
  }).strict().parse(req.body);

  const session = await Session.findOneAndUpdate(
    {
      sessionId,
      studentId: req.auth!.id,
      endedAt: { $exists: true },
      feedbackSubmittedAt: { $exists: false }
    },
    {
      $set: {
        rating,
        ...(feedback ? { feedbackText: feedback } : {}),
        feedbackSubmittedAt: new Date()
      }
    },
    { new: true }
  ).select("+studentId");

  if (!session) {
    const exists = await participant(sessionId, req.auth!.id);
    return res.status(exists ? 409 : 404).json({
      message: exists ? "Feedback was already submitted or the session is still active" : "Session not found"
    });
  }

  if (rating <= 2) {
    await AuditLog.create({
      action: "session.feedback_low",
      actorId: req.auth!.id,
      actorRole: req.auth!.role,
      targetType: "Session",
      targetId: session.sessionId,
      metadata: { rating, resolved: false }
    });
  }
  res.json({
    message: "Thank you for your feedback",
    feedback: { sessionId: session.sessionId, rating, savedAt: session.feedbackSubmittedAt }
  });
}

export async function escalateSession(req: Request, res: Response) {
  const sessionId = z.string().uuid().parse(req.params.sessionId);
  const session = await Session.findOne({
    sessionId,
    endedAt: { $exists: false },
    $or: [{ studentId: req.auth!.id }, { psychologistId: req.auth!.id }]
  }).select("+studentId");
  if (!session) return res.status(404).json({ message: "Active session not found" });

  const recent = await AuditLog.exists({
    action: "session.safety_escalated",
    actorId: req.auth!.id,
    targetId: session.sessionId,
    createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
  });
  if (recent) return res.status(202).json({ message: "Your safety alert has already been sent" });

  await AuditLog.create({
    action: "session.safety_escalated",
    actorId: req.auth!.id,
    actorRole: req.auth!.role,
    targetType: "Session",
    targetId: session.sessionId,
    metadata: { resolved: false, raisedAt: new Date() }
  });
  res.status(201).json({ message: "Safety alert sent to the administration team" });
}
