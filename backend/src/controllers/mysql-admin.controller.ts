import type { Request, Response } from "express";
import { sql } from "kysely";
import { getMysqlDatabase } from "../database/client.js";
import { MysqlAuditRepository, MysqlNotificationRepository, MysqlUserRepository } from "../repositories/mysql/index.js";

const users = new MysqlUserRepository();
const audits = new MysqlAuditRepository();
const notifications = new MysqlNotificationRepository();

const count = async (table: "users" | "emergency_requests" | "sessions", where?: { column: string; value: unknown }) => {
  let query = getMysqlDatabase().selectFrom(table).select(eb => eb.fn.count<string>("id").as("count")) as any;
  if (where) query = query.where(where.column, "=", where.value);
  return Number((await query.executeTakeFirstOrThrow()).count);
};

export async function mysqlAdminAnalytics(_req: Request, res: Response) {
  const db = getMysqlDatabase(); const since = new Date(Date.now() - 7 * 86_400_000);
  const requestDay = sql<string>`DATE_FORMAT(created_at, '%Y-%m-%d')`;
  const [students, activeStudents, psychologists, online, totalRequests, pending, timeouts, matched, sessionCount, rating, waits, daily, statusMix, modeMix] = await Promise.all([
    count("users", { column: "role", value: "student" }),
    db.selectFrom("users").select(eb => eb.fn.count<string>("id").as("count")).where("role", "=", "student").where("is_active", "=", true).executeTakeFirstOrThrow().then(x => Number(x.count)),
    count("users", { column: "role", value: "psychologist" }),
    db.selectFrom("psychologist_profiles").select(eb => eb.fn.count<string>("user_id").as("count")).where("is_online", "=", true).executeTakeFirstOrThrow().then(x => Number(x.count)),
    count("emergency_requests"), count("emergency_requests", { column: "status", value: "pending" }), count("emergency_requests", { column: "status", value: "timeout" }),
    db.selectFrom("emergency_requests").select(eb => eb.fn.count<string>("id").as("count")).where("status", "in", ["matched", "ended"]).executeTakeFirstOrThrow().then(x => Number(x.count)),
    count("sessions"),
    db.selectFrom("sessions").select([eb => eb.fn.avg<number>("rating").as("average"), eb => eb.fn.count<string>("rating").as("count")]).where("rating", "is not", null).executeTakeFirstOrThrow(),
    db.selectFrom("emergency_requests").select([sql<number>`AVG(TIMESTAMPDIFF(SECOND, created_at, matched_at))`.as("average"), sql<number>`MAX(TIMESTAMPDIFF(SECOND, created_at, matched_at))`.as("longest")]).where("matched_at", "is not", null).executeTakeFirst(),
    db.selectFrom("emergency_requests").select([requestDay.as("date"), eb => eb.fn.count<string>("id").as("count")]).where("created_at", ">=", since).groupBy(requestDay).orderBy("date").execute(),
    db.selectFrom("emergency_requests").select(["status as label", eb => eb.fn.count<string>("id").as("count")]).groupBy("status").execute(),
    db.selectFrom("emergency_requests").select(["mode as label", eb => eb.fn.count<string>("id").as("count")]).groupBy("mode").execute(),
  ]);
  res.json({ analytics: { students, activeStudents, psychologists, onlinePsychologists: online, totalRequests, pendingRequests: pending, totalSessions: sessionCount, matchRate: totalRequests ? Math.round(matched / totalRequests * 100) : 0, timeoutRate: totalRequests ? Math.round(timeouts / totalRequests * 100) : 0, averageWaitSeconds: Math.round(Number(waits?.average ?? 0)), longestWaitSeconds: Math.round(Number(waits?.longest ?? 0)), averageRating: Number(Number(rating.average ?? 0).toFixed(1)), ratingCount: Number(rating.count), dailyRequests: daily.map(x => ({ date: x.date, count: Number(x.count) })), statusMix: statusMix.map(x => ({ label: x.label, count: Number(x.count) })), modeMix: modeMix.map(x => ({ label: x.label, count: Number(x.count) })) } });
}
export async function mysqlAdminStudents(req: Request, res: Response) {
  const search = String(req.query.search ?? "").trim(); const active = req.query.active;
  const rows = await users.list({ role: "student", search: search || undefined, active: active === "true" ? true : active === "false" ? false : undefined, limit: 200 });
  const db = getMysqlDatabase(); const ids = rows.map(row => row.id);
  const profiles = ids.length ? await db.selectFrom("student_profiles as p").innerJoin("users as u", "u.id", "p.user_id").innerJoin("departments as d", "d.id", "p.department_id").select(["u.user_uuid", "p.roll_number", "p.mobile_number", "d.name as department"]).where("u.user_uuid", "in", ids).execute() : [];
  const byId = new Map(profiles.map(row => [row.user_uuid, row]));
  res.json({ students: rows.map(row => ({ ...row, rollNumber: byId.get(row.id)?.roll_number, mobileNumber: byId.get(row.id)?.mobile_number, department: byId.get(row.id)?.department })) });
}
export async function mysqlAdminSessions(_req: Request, res: Response) {
  const rows = await getMysqlDatabase().selectFrom("sessions as s").innerJoin("users as p", "p.id", "s.psychologist_id").select(["s.session_uuid as sessionId", "s.mode", "s.started_at as startedAt", "s.ended_at as endedAt", "s.rating", "p.user_uuid as psychologistId", "p.full_name as psychologistName"]).orderBy("s.started_at", "desc").limit(200).execute();
  res.json({ sessions: rows });
}
export async function mysqlAdminReports(req: Request, res: Response) {
  const status = String(req.query.status ?? ""); res.json({ reports: await audits.listReports(status === "pending" || status === "resolved" ? status : undefined, 200) });
}
export async function mysqlResolveReport(req: Request, res: Response) {
  const reportId = String(req.params.id); const ok = await audits.resolve(reportId, req.auth!.id); if (!ok) return res.status(404).json({ message: "Report not found or already resolved" });
  await notifications.markAllRead(req.auth!.id, "admin"); res.json({ report: { id: reportId, resolved: true } });
}
