import { createNotification } from "./notification.service.js";
import { getMysqlDatabase } from "../database/client.js";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";

const HOUR_MS = 60 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
const schedulerOwner = randomUUID();

async function acquireMysqlLease(now: Date) {
  const db = getMysqlDatabase(); const expires = new Date(now.getTime() + 10 * 60_000);
  await sql`INSERT INTO scheduler_leases (lease_name, owner_uuid, acquired_at, heartbeat_at, expires_at)
    VALUES ('notification-hourly', ${schedulerOwner}, ${now}, ${now}, ${expires})
    ON DUPLICATE KEY UPDATE
      owner_uuid = IF(expires_at <= VALUES(acquired_at) OR owner_uuid = VALUES(owner_uuid), VALUES(owner_uuid), owner_uuid),
      acquired_at = IF(expires_at <= VALUES(acquired_at), VALUES(acquired_at), acquired_at),
      heartbeat_at = IF(expires_at <= VALUES(heartbeat_at) OR owner_uuid = VALUES(owner_uuid), VALUES(heartbeat_at), heartbeat_at),
      expires_at = IF(expires_at <= VALUES(heartbeat_at) OR owner_uuid = VALUES(owner_uuid), VALUES(expires_at), expires_at)`.execute(db);
  return Boolean(await db.selectFrom("scheduler_leases").select("lease_name").where("lease_name", "=", "notification-hourly").where("owner_uuid", "=", schedulerOwner).executeTakeFirst());
}

async function runMysqlNotificationJobs(now: Date) {
  if (!await acquireMysqlLease(now)) return { assessmentEligibility: { scanned: 0, failed: 0 }, leaseAcquired: false };
  const db = getMysqlDatabase();
  const rows = await db.selectFrom("users as u").innerJoin("student_profiles as p", "p.user_id", "u.id").leftJoin("notification_preferences as np", "np.user_id", "u.id")
    .select(["u.user_uuid", "p.assessment_next_eligible_at", "np.assessment_reminders", "np.push_enabled"])
    .where("u.role", "=", "student").where("u.verified", "=", true).where("u.is_active", "=", true)
    .where("p.assessment_next_eligible_at", "<=", now).where(eb => eb.or([eb("np.assessment_reminders", "is", null), eb("np.assessment_reminders", "=", true)])).limit(500).execute();
  const results = await Promise.allSettled(rows.map(student => createNotification({
    recipientId: student.user_uuid, recipientRole: "student", type: "assessment.eligible",
    title: "Your weekly check-in is ready", message: "Take a few private minutes to reflect on how you have been feeling.", priority: "low",
    actionUrl: "/student/assessment", entityType: "AssessmentEligibility", entityId: student.assessment_next_eligible_at!.toISOString(),
    channels: student.push_enabled === false ? ["in_app", "socket"] : ["in_app", "socket", "push"],
    deduplicationKey: `assessment-eligible:${student.assessment_next_eligible_at!.toISOString()}`,
    expiresAt: new Date(student.assessment_next_eligible_at!.getTime() + 7 * 24 * HOUR_MS),
  })));
  return { assessmentEligibility: { scanned: rows.length, failed: results.filter(x => x.status === "rejected").length }, leaseAcquired: true };
}

export async function runNotificationJobs(now = new Date()) {
  return runMysqlNotificationJobs(now);
}

export function startNotificationScheduler() {
  if (timer) return;
  const execute = () => void runNotificationJobs().catch(error => console.error("Notification scheduler failed", error));
  execute();
  timer = setInterval(execute, HOUR_MS);
  timer.unref();
}

export function stopNotificationScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
