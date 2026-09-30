import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { getMysqlDatabase } from "../database/client.js";
import { MysqlAssessmentRepository, MysqlAuditRepository } from "../repositories/mysql/index.js";
import { RepositoryConflictError } from "../repositories/repository.types.js";
import { createNotification, createNotificationForRole } from "../services/notification.service.js";

const assessments = new MysqlAssessmentRepository();
const audits = new MysqlAuditRepository();
export const ASSESSMENT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const nextEligibleFrom = (completedAt: Date) => new Date(completedAt.getTime() + ASSESSMENT_INTERVAL_MS);

export async function mysqlAssessmentStatus(req: Request, res: Response) {
  const history = await assessments.listForStudent(req.auth!.id, 12);
  const latest = history[0] ?? null;
  const nextEligibleAt = await assessments.nextEligibleAt(req.auth!.id);
  res.json({ eligible: !nextEligibleAt || nextEligibleAt <= new Date(), nextEligibleAt, latest, history });
}
export async function mysqlSubmitAssessment(req: Request, res: Response) {
  const { answers } = z.object({ answers: z.array(z.boolean()).length(20) }).strict().parse(req.body);
  const now = new Date();
  try {
    const result = await assessments.create({ assessmentUuid: randomUUID(), studentUuid: req.auth!.id, answers, completedAt: now });
    if (result.band === "urgent" || result.safetyFlag) {
      await audits.create({ auditUuid: randomUUID(), action: "assessment.support_alert", actorUuid: req.auth!.id, actorRole: "student", targetType: "Assessment", targetId: result.id, metadata: { score: result.score, band: result.band, safetyFlag: result.safetyFlag } });
      await createNotificationForRole("admin", { type: "assessment.support_alert", title: "Wellbeing alert requires review", message: "A protected assessment alert requires attention.", priority: "critical", actionUrl: "/admin/assessments", entityType: "Assessment", entityId: result.id, channels: ["in_app", "socket", "push"], deduplicationKey: id => `assessment-alert:${result.id}:${id}` });
    }
    await createNotification({ recipientId: req.auth!.id, recipientRole: "student", type: "assessment.submitted", title: "Check-in saved", message: "Your weekly wellbeing check-in was saved.", actionUrl: "/student/assessment", entityType: "Assessment", entityId: result.id, deduplicationKey: `assessment-submitted:${result.id}` });
    return res.status(201).json({ result, nextEligibleAt: nextEligibleFrom(now) });
  } catch (error) {
    if (error instanceof RepositoryConflictError) return res.status(409).json({ message: "Your weekly assessment was already submitted" });
    throw error;
  }
}
export async function mysqlAdminAssessments(_req: Request, res: Response) {
  const db = getMysqlDatabase();
  const rows = await db.selectFrom("assessments as a").innerJoin("users as u", "u.id", "a.student_id").leftJoin("student_profiles as p", "p.user_id", "u.id")
    .leftJoin("departments as d", "d.id", "p.department_id")
    .select(["a.assessment_uuid as id", "a.score", "a.band", "a.safety_flag as safetyFlag", "a.completed_at as completedAt", "u.user_uuid as studentId", "u.full_name as studentName", "p.roll_number as rollNumber", "d.name as department"])
    .orderBy("a.completed_at", "desc").limit(300).execute();
  res.json({ assessments: rows, distribution: await assessments.distribution() });
}
