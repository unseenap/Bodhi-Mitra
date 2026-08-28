import { NotificationPreference } from "../models/NotificationPreference.js";
import { User } from "../models/User.js";
import { createNotification } from "./notification.service.js";

const HOUR_MS = 60 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;

export async function runNotificationJobs(now = new Date()) {
  const preferences = await NotificationPreference.find().select("userId assessmentReminders push").lean();
  const disabledIds = preferences.filter(item => !item.assessmentReminders).map(item => item.userId);
  const preferencesByUser = new Map(preferences.map(item => [String(item.userId), item]));
  const students = await User.find({
    role: "student", verified: true, isActive: true,
    assessmentNextEligibleAt: { $lte: now },
    ...(disabledIds.length ? { _id: { $nin: disabledIds } } : {})
  }).select("+assessmentNextEligibleAt").limit(500);

  const results = await Promise.allSettled(students.map(student => {
    const eligibleAt = student.assessmentNextEligibleAt!;
    const preference = preferencesByUser.get(student.id);
    return createNotification({
      recipientId: student.id,
      recipientRole: "student",
      type: "assessment.eligible",
      title: "Your weekly check-in is ready",
      message: "Take a few private minutes to reflect on how you have been feeling.",
      priority: "low",
      actionUrl: "/student/assessment",
      entityType: "AssessmentEligibility",
      entityId: eligibleAt.toISOString(),
      channels: preference?.push === false ? ["in_app", "socket"] : ["in_app", "socket", "push"],
      deduplicationKey: `assessment-eligible:${eligibleAt.toISOString()}`,
      expiresAt: new Date(eligibleAt.getTime() + 7 * 24 * HOUR_MS)
    });
  }));
  return { assessmentEligibility: { scanned: students.length, failed: results.filter(item => item.status === "rejected").length } };
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
