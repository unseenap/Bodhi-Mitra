import { randomBytes, randomUUID } from "node:crypto";
import { env, hotlines } from "../config/env.js";
import { getMysqlDatabase } from "../database/client.js";
import type { SessionMode } from "../repositories/emergency.repository.js";
import { MysqlEmergencyRepository, MysqlPsychologistRepository, MysqlSessionRepository } from "../repositories/mysql/index.js";

const emergencies = new MysqlEmergencyRepository();
const sessions = new MysqlSessionRepository();
const psychologists = new MysqlPsychologistRepository();

export async function createMysqlEmergency(studentId: string, mode: SessionMode, context?: { mood?: string; urgent?: boolean }) {
  if (await emergencies.findActiveForStudent(studentId))
    throw Object.assign(new Error("You already have an active request"), { status: 409 });
  return emergencies.create({
    requestUuid: randomUUID(), studentUuid: studentId,
    anonId: `Student ${randomBytes(3).toString("hex").toUpperCase()}`,
    mode, mood: context?.mood, urgent: context?.urgent,
    timeoutAt: new Date(Date.now() + env.REQUEST_TIMEOUT_SECONDS * 1000),
  });
}

export async function acceptMysqlEmergency(requestId: string, psychologistId: string) {
  const profile = await psychologists.findByUuid(psychologistId);
  if (!profile?.verified || !profile.isActive || !profile.isAvailable)
    throw Object.assign(new Error("Set yourself as available before accepting requests"), { status: 403 });
  const db = getMysqlDatabase();
  return db.transaction().execute(async transaction => {
    const request = await transaction.selectFrom("emergency_requests as e")
      .innerJoin("users as student", "student.id", "e.student_id")
      .select(["e.id", "e.request_uuid", "e.mode", "e.mood", "e.urgent", "e.anon_id", "student.user_uuid as student_uuid"])
      .where("e.request_uuid", "=", requestId).where("e.status", "=", "pending")
      .where("e.timeout_at", ">", new Date()).forUpdate().executeTakeFirst();
    if (!request) return null;
    const psychologist = await transaction.selectFrom("users").select("id")
      .where("user_uuid", "=", psychologistId).where("role", "=", "psychologist")
      .where("verified", "=", true).where("is_active", "=", true).executeTakeFirstOrThrow();
    const matchedAt = new Date();
    await transaction.updateTable("emergency_requests").set({
      status: "matched", psychologist_id: psychologist.id, matched_at: matchedAt,
    }).where("id", "=", request.id).executeTakeFirstOrThrow();
    const sessionId = randomUUID();
    await transaction.insertInto("sessions").values({
      session_uuid: sessionId, request_id: request.id, mode: request.mode,
      student_id: (await transaction.selectFrom("emergency_requests").select("student_id").where("id", "=", request.id).executeTakeFirstOrThrow()).student_id,
      psychologist_id: psychologist.id, ended_at: null, rating: null,
      feedback_text: null, feedback_submitted_at: null,
    }).executeTakeFirstOrThrow();
    return {
      request: { id: request.request_uuid, studentId: request.student_uuid, mode: request.mode, mood: request.mood, urgent: Boolean(request.urgent), anonId: request.anon_id },
      session: { sessionId },
    };
  });
}

export async function expireMysqlEmergency(requestId: string) {
  const db = getMysqlDatabase();
  const request = await db.selectFrom("emergency_requests as e").innerJoin("users as u", "u.id", "e.student_id")
    .select(["e.request_uuid", "u.user_uuid as studentId"])
    .where("e.request_uuid", "=", requestId).where("e.status", "=", "pending").executeTakeFirst();
  if (!request || !await emergencies.expire(requestId, new Date())) return null;
  return request;
}

export async function cancelMysqlEmergency(requestId: string, studentId: string) {
  const db = getMysqlDatabase();
  const result = await db.updateTable("emergency_requests")
    .set({ status: "cancelled" }).where("request_uuid", "=", requestId)
    .where("student_id", "=", db.selectFrom("users").select("id").where("user_uuid", "=", studentId)).where("status", "=", "pending").executeTakeFirst();
  return result.numUpdatedRows === 1n;
}

export async function endMysqlSession(sessionId: string, userId: string) {
  const session = await sessions.findParticipant(sessionId, userId, true);
  if (!session || !await sessions.end(sessionId)) return null;
  await getMysqlDatabase().updateTable("emergency_requests").set({ status: "ended" })
    .where("request_uuid", "=", session.requestId).executeTakeFirst();
  return session;
}

export { hotlines };
