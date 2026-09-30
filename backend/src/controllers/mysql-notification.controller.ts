import type { Request, Response } from "express";
import { z } from "zod";
import { getMysqlDatabase } from "../database/client.js";
import { MysqlNotificationRepository, MysqlPushSubscriptionRepository } from "../repositories/mysql/index.js";

const notifications = new MysqlNotificationRepository();
const pushes = new MysqlPushSubscriptionRepository();
const id = z.string().uuid();
const listQuery = z.object({ filter: z.enum(["all", "unread", "action_required"]).default("all"), cursor: z.string().max(500).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const preferences = z.object({ inApp: z.boolean().optional(), push: z.boolean().optional(), email: z.boolean().optional(), assessmentReminders: z.boolean().optional(), wellbeingReminders: z.boolean().optional(), maintenanceNotices: z.boolean().optional(), quietHours: z.object({ enabled: z.boolean(), start: time, end: time, timezone: z.string().trim().min(1).max(80) }).optional() }).strict();
const subscription = z.object({ endpoint: z.string().url().max(2000), expirationTime: z.number().nullable().optional(), keys: z.object({ p256dh: z.string().min(20).max(500), auth: z.string().min(8).max(500) }).strict() }).strict();

export async function mysqlListNotifications(req: Request, res: Response) { const query = listQuery.parse(req.query); const page = await notifications.list(req.auth!.id, req.auth!.role, query); res.json({ notifications: page.items, nextCursor: page.nextCursor }); }
export async function mysqlUnreadNotificationCount(req: Request, res: Response) { res.json({ unread: await notifications.unreadCount(req.auth!.id, req.auth!.role) }); }
export async function mysqlMarkNotificationRead(req: Request, res: Response) { if (!await notifications.markRead(id.parse(req.params.notificationId), req.auth!.id)) return res.status(404).json({ message: "Notification not found" }); res.json({ notification: { id: req.params.notificationId, readAt: new Date() } }); }
export async function mysqlAcknowledgeNotification(req: Request, res: Response) { if (!await notifications.acknowledge(id.parse(req.params.notificationId), req.auth!.id)) return res.status(404).json({ message: "Actionable notification not found" }); res.json({ notification: { id: req.params.notificationId, readAt: new Date(), acknowledgedAt: new Date() } }); }
export async function mysqlMarkAllNotificationsRead(req: Request, res: Response) { res.json({ updated: await notifications.markAllRead(req.auth!.id, req.auth!.role) }); }
async function internalUserId(uuid: string) { return (await getMysqlDatabase().selectFrom("users").select("id").where("user_uuid", "=", uuid).executeTakeFirstOrThrow()).id; }
export async function mysqlGetNotificationPreferences(req: Request, res: Response) {
  const db = getMysqlDatabase(); const userId = await internalUserId(req.auth!.id);
  await db.insertInto("notification_preferences").values({ user_id: userId, timezone: "Asia/Kolkata" }).ignore().executeTakeFirst();
  const row = await db.selectFrom("notification_preferences").selectAll().where("user_id", "=", userId).executeTakeFirstOrThrow();
  res.json({ preferences: { inApp: Boolean(row.in_app_enabled), push: Boolean(row.push_enabled), email: Boolean(row.email_enabled), assessmentReminders: Boolean(row.assessment_reminders), wellbeingReminders: Boolean(row.wellbeing_reminders), maintenanceNotices: Boolean(row.maintenance_notices), quietHours: { enabled: Boolean(row.quiet_hours_enabled), start: row.quiet_hours_start, end: row.quiet_hours_end, timezone: row.timezone } }, pushSubscribed: (await pushes.list(req.auth!.id)).length > 0 });
}
export async function mysqlUpdateNotificationPreferences(req: Request, res: Response) {
  const value = preferences.parse(req.body); const db = getMysqlDatabase(); const userId = await internalUserId(req.auth!.id);
  await db.insertInto("notification_preferences").values({ user_id: userId, timezone: "Asia/Kolkata" }).ignore().executeTakeFirst();
  await db.updateTable("notification_preferences").set({ ...(value.inApp !== undefined && { in_app_enabled: value.inApp }), ...(value.push !== undefined && { push_enabled: value.push }), ...(value.email !== undefined && { email_enabled: value.email }), ...(value.assessmentReminders !== undefined && { assessment_reminders: value.assessmentReminders }), ...(value.wellbeingReminders !== undefined && { wellbeing_reminders: value.wellbeingReminders }), ...(value.maintenanceNotices !== undefined && { maintenance_notices: value.maintenanceNotices }), ...(value.quietHours && { quiet_hours_enabled: value.quietHours.enabled, quiet_hours_start: value.quietHours.start, quiet_hours_end: value.quietHours.end, timezone: value.quietHours.timezone }) }).where("user_id", "=", userId).executeTakeFirst();
  return mysqlGetNotificationPreferences(req, res);
}
export async function mysqlSubscribeNotificationPush(req: Request, res: Response) { await pushes.save(req.auth!.id, subscription.parse(req.body)); res.status(201).json({ message: "Browser notifications are enabled" }); }
export async function mysqlUnsubscribeNotificationPush(req: Request, res: Response) { const { endpoint } = z.object({ endpoint: z.string().url().max(2000) }).strict().parse(req.body); await pushes.remove(req.auth!.id, endpoint); res.json({ message: "Browser notifications are disabled on this device" }); }
