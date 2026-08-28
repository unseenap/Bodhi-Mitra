import type { Request, Response } from "express";
import { z } from "zod";
import { Notification } from "../models/Notification.js";
import { NotificationPreference } from "../models/NotificationPreference.js";
import { User } from "../models/User.js";
import { removeSubscription, saveSubscription } from "../services/push.service.js";
import { toSafeNotification } from "../services/notification.service.js";

const listQuerySchema = z.object({
  filter: z.enum(["all", "unread", "action_required"]).default("all"),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});
const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const preferencesSchema = z.object({
  inApp: z.boolean().optional(), push: z.boolean().optional(), email: z.boolean().optional(),
  assessmentReminders: z.boolean().optional(), wellbeingReminders: z.boolean().optional(), maintenanceNotices: z.boolean().optional(),
  quietHours: z.object({ enabled: z.boolean(), start: timeSchema, end: timeSchema, timezone: z.string().trim().min(1).max(80) }).optional()
}).strict();
const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(20).max(500), auth: z.string().min(8).max(500) }).strict()
}).strict();

function encodeCursor(record: any) {
  return Buffer.from(JSON.stringify({ createdAt: record.createdAt.toISOString(), id: String(record._id) })).toString("base64url");
}
function decodeCursor(value?: string) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return z.object({ createdAt: z.string().datetime(), id: idSchema }).parse(parsed);
  } catch {
    throw Object.assign(new Error("Invalid notification cursor"), { status: 400 });
  }
}

export async function listNotifications(req: Request, res: Response) {
  const { filter, cursor: rawCursor, limit } = listQuerySchema.parse(req.query);
  const cursor = decodeCursor(rawCursor);
  const now = new Date();
  const query: Record<string, unknown> = {
    recipientId: req.auth!.id,
    recipientRole: req.auth!.role,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }]
  };
  if (filter === "unread") query.readAt = { $exists: false };
  if (filter === "action_required") {
    query.priority = { $in: ["critical", "high"] };
    query.readAt = { $exists: false };
  }
  if (cursor) {
    query.$and = [{ $or: [
      { createdAt: { $lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), _id: { $lt: cursor.id } }
    ] }];
  }
  const rows = await Notification.find(query).sort({ createdAt: -1, _id: -1 }).limit(limit + 1);
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  res.json({
    notifications: visible.map(toSafeNotification),
    nextCursor: hasMore && visible.length ? encodeCursor(visible[visible.length - 1]) : null
  });
}

export async function unreadNotificationCount(req: Request, res: Response) {
  const unread = await Notification.countDocuments({
    recipientId: req.auth!.id,
    recipientRole: req.auth!.role,
    readAt: { $exists: false },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }]
  });
  res.json({ unread });
}

export async function markNotificationRead(req: Request, res: Response) {
  const notificationId = idSchema.parse(req.params.notificationId);
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientId: req.auth!.id, recipientRole: req.auth!.role },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: "Notification not found" });
  res.json({ notification: toSafeNotification(notification) });
}

export async function acknowledgeNotification(req: Request, res: Response) {
  const notificationId = idSchema.parse(req.params.notificationId);
  const now = new Date();
  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipientId: req.auth!.id,
      recipientRole: req.auth!.role,
      priority: { $in: ["critical", "high"] }
    },
    { $set: { readAt: now, acknowledgedAt: now } },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: "Actionable notification not found" });
  res.json({ notification: toSafeNotification(notification) });
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  const result = await Notification.updateMany(
    { recipientId: req.auth!.id, recipientRole: req.auth!.role, readAt: { $exists: false } },
    { $set: { readAt: new Date() } }
  );
  res.json({ updated: result.modifiedCount });
}

export async function getNotificationPreferences(req: Request, res: Response) {
  const preferences = await NotificationPreference.findOneAndUpdate(
    { userId: req.auth!.id }, { $setOnInsert: { userId: req.auth!.id } }, { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const user = await User.findById(req.auth!.id).select("+pushSubscriptions").lean();
  res.json({ preferences, pushSubscribed: Boolean(user?.pushSubscriptions?.length) });
}

export async function updateNotificationPreferences(req: Request, res: Response) {
  const update = preferencesSchema.parse(req.body);
  const preferences = await NotificationPreference.findOneAndUpdate(
    { userId: req.auth!.id }, { $set: update }, { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
  res.json({ preferences });
}

export async function subscribeNotificationPush(req: Request, res: Response) {
  const subscription = subscriptionSchema.parse(req.body);
  await saveSubscription(req.auth!.id, subscription);
  res.status(201).json({ message: "Browser notifications are enabled" });
}

export async function unsubscribeNotificationPush(req: Request, res: Response) {
  const { endpoint } = z.object({ endpoint: z.string().url().max(2000) }).strict().parse(req.body);
  await removeSubscription(req.auth!.id, endpoint);
  res.json({ message: "Browser notifications are disabled on this device" });
}
