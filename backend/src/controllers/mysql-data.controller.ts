import type { Request, Response } from "express";
import { getMysqlDatabase } from "../database/client.js";
import { MysqlEmergencyRepository, MysqlPsychologistRepository, MysqlPushSubscriptionRepository, MysqlSessionRepository } from "../repositories/mysql/index.js";
import { sql } from "kysely";

const emergencies = new MysqlEmergencyRepository();
const sessions = new MysqlSessionRepository();
const psychologists = new MysqlPsychologistRepository();
const push = new MysqlPushSubscriptionRepository();

export async function mysqlStudentHistory(req: Request, res: Response) {
  res.json({ requests: await emergencies.listStudentHistory(req.auth!.id, 50) });
}
export async function mysqlActiveStudentEmergency(req: Request, res: Response) {
  const request = await emergencies.findActiveForStudent(req.auth!.id);
  if (!request) return res.json({ active: null });
  const session = request.status === "matched" ? (await sessions.listForStudent(req.auth!.id, 20)).find(row => row.requestId === request.id && !row.endedAt) : null;
  res.json({ active: {
    requestId: request.id, anonId: request.anonId, mode: request.mode, mood: request.mood,
    urgent: request.urgent, status: request.status, waitStartedAt: request.createdAt,
    timeoutAt: request.timeoutAt,
    session: session ? { sessionId: session.id, mode: session.mode, mood: request.mood, urgent: request.urgent, peerLabel: "Bodhi-Mitra psychologist" } : null,
  }});
}
export async function mysqlPsychologistQueue(_req: Request, res: Response) {
  const rows = await emergencies.listQueue(new Date(), 100);
  res.json({ requests: rows.map(row => ({ requestId: row.id, anonId: row.anonId, mode: row.mode, mood: row.mood, urgent: row.urgent, waitStartedAt: row.createdAt })) });
}
export async function mysqlSessionHistory(req: Request, res: Response) {
  res.json({ sessions: await sessions.listForPsychologist(req.auth!.id, 50) });
}
export async function mysqlSubscribePush(req: Request, res: Response) {
  await push.save(req.auth!.id, req.body); res.status(201).json({ message: "Notifications enabled" });
}
export async function mysqlMetrics(_req: Request, res: Response) {
  const db = getMysqlDatabase();
  const [online, total, timedOut, matched, daily, waits] = await Promise.all([
    db.selectFrom("psychologist_profiles").select(eb => eb.fn.count<string>("user_id").as("count")).where("is_online", "=", true).executeTakeFirstOrThrow(),
    db.selectFrom("emergency_requests").select(eb => eb.fn.count<string>("id").as("count")).executeTakeFirstOrThrow(),
    db.selectFrom("emergency_requests").select(eb => eb.fn.count<string>("id").as("count")).where("status", "=", "timeout").executeTakeFirstOrThrow(),
    db.selectFrom("emergency_requests").select(eb => eb.fn.count<string>("id").as("count")).where("status", "in", ["matched", "ended"]).executeTakeFirstOrThrow(),
    db.selectFrom("emergency_requests").select(eb => eb.fn.count<string>("id").as("count")).where("created_at", ">=", new Date(Date.now() - 86_400_000)).executeTakeFirstOrThrow(),
    db.selectFrom("emergency_requests").select(sql<number>`AVG(TIMESTAMPDIFF(SECOND, created_at, matched_at))`.as("average")).where("matched_at", "is not", null).executeTakeFirst(),
  ]);
  const totalCount = Number(total.count);
  res.json({ metrics: { psychologistsOnline: Number(online.count), requestsToday: Number(daily.count), averageWaitSeconds: Math.round(Number(waits?.average ?? 0)), timeoutRate: totalCount ? Math.round(Number(timedOut.count) / totalCount * 100) : 0, matchedRequests: Number(matched.count) } });
}

export async function mysqlPsychologistSummary(req: Request, res: Response) {
  const profile = await psychologists.findByUuid(req.auth!.id);
  if (!profile) return res.status(404).json({ message: "Account not found" });
  const db = getMysqlDatabase(); const today = new Date(); today.setHours(0,0,0,0);
  const [total, todayCount, pending, modes, average] = await Promise.all([
    db.selectFrom("sessions as s").innerJoin("users as u", "u.id", "s.psychologist_id").select(eb => eb.fn.count<string>("s.id").as("count")).where("u.user_uuid", "=", req.auth!.id).executeTakeFirstOrThrow(),
    db.selectFrom("sessions as s").innerJoin("users as u", "u.id", "s.psychologist_id").select(eb => eb.fn.count<string>("s.id").as("count")).where("u.user_uuid", "=", req.auth!.id).where("s.started_at", ">=", today).executeTakeFirstOrThrow(),
    db.selectFrom("emergency_requests").select(eb => eb.fn.count<string>("id").as("count")).where("status", "=", "pending").where("timeout_at", ">", new Date()).executeTakeFirstOrThrow(),
    db.selectFrom("sessions as s").innerJoin("users as u", "u.id", "s.psychologist_id").select(["s.mode", eb => eb.fn.count<string>("s.id").as("count")]).where("u.user_uuid", "=", req.auth!.id).groupBy("s.mode").execute(),
    db.selectFrom("sessions as s").innerJoin("users as u", "u.id", "s.psychologist_id").select(sql<number>`AVG(TIMESTAMPDIFF(MINUTE, s.started_at, s.ended_at))`.as("minutes")).where("u.user_uuid", "=", req.auth!.id).where("s.ended_at", "is not", null).executeTakeFirst(),
  ]);
  res.json({ summary: { profile, totalSessions: Number(total.count), sessionsToday: Number(todayCount.count), pendingRequests: Number(pending.count), averageDurationMinutes: Math.round(Number(average?.minutes ?? 0)), modeMix: modes.map(x => ({ label: x.mode, count: Number(x.count) })) } });
}
export async function mysqlPsychologistProfile(req: Request, res: Response) { const profile = await psychologists.findByUuid(req.auth!.id); if (!profile) return res.status(404).json({ message: "Account not found" }); res.json({ profile }); }
export async function mysqlSetAvailability(req: Request, res: Response) { const available = Boolean(req.body?.isAvailable); await psychologists.setAvailability(req.auth!.id, available); res.json({ isAvailable: available }); }
