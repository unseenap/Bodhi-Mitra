import { randomUUID } from "node:crypto";
import type { Role } from "@bodhi/shared";
import { getMysqlDatabase } from "../database/client.js";
import { MysqlNotificationRepository, MysqlUserRepository } from "../repositories/mysql/index.js";
import { sendMysqlPushToUser } from "./mysql-push.service.js";

export type NotificationPriority = "critical" | "high" | "normal" | "low";
export type NotificationChannel = "in_app" | "socket" | "push" | "email";
export type NotificationInput = {
  recipientId: string; recipientRole: Role; type: string; title: string;
  message: string; priority?: NotificationPriority; actionUrl?: string;
  entityType?: string; entityId?: string; channels?: NotificationChannel[];
  deduplicationKey: string; expiresAt?: Date;
};

type NotificationEmitter = (recipientId: string, payload: Record<string, unknown>) => void;
let emitNotification: NotificationEmitter | null = null;
const notifications = new MysqlNotificationRepository();
const users = new MysqlUserRepository();

export function setNotificationEmitter(emitter: NotificationEmitter) { emitNotification = emitter; }
function assertInternalActionUrl(value?: string) {
  if (value && (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")))
    throw new Error("Notification action URL must be an internal application path");
}
export function toSafeNotification(record: any) {
  return { id: record.id, type: record.type, title: record.title, message: record.message,
    priority: record.priority, actionUrl: record.actionUrl, readAt: record.readAt,
    acknowledgedAt: record.acknowledgedAt, createdAt: record.createdAt, expiresAt: record.expiresAt };
}

export async function createNotification(input: NotificationInput) {
  assertInternalActionUrl(input.actionUrl);
  const channels = [...new Set(input.channels ?? ["in_app", "socket"])] as NotificationChannel[];
  const record = await notifications.create({
    notificationUuid: randomUUID(), recipientUuid: input.recipientId,
    recipientRole: input.recipientRole, type: input.type, title: input.title,
    message: input.message, priority: input.priority, actionUrl: input.actionUrl,
    entityType: input.entityType, entityId: input.entityId, channels,
    deduplicationKey: input.deduplicationKey, expiresAt: input.expiresAt,
  });
  const safe = toSafeNotification(record);
  if (channels.includes("socket")) emitNotification?.(input.recipientId, safe);
  if (channels.includes("push")) void sendMysqlPushToUser(input.recipientId, {
    title: input.title, body: input.message, url: input.actionUrl ?? `/${input.recipientRole}`,
    tag: `${input.type}:${input.entityId ?? record.id}`,
  });
  return record;
}

export async function createNotificationForRole(
  role: Role,
  input: Omit<NotificationInput, "recipientId" | "recipientRole" | "deduplicationKey"> & { deduplicationKey: string | ((recipientId: string) => string) },
  userFilter: { isAvailable?: boolean } = {},
) {
  let ids = await users.listActiveIdsByRole(role);
  if (role === "psychologist" && userFilter.isAvailable !== undefined) {
    const available = await getMysqlDatabase().selectFrom("users as u").innerJoin("psychologist_profiles as p", "p.user_id", "u.id")
      .select("u.user_uuid").where("u.role", "=", "psychologist").where("u.verified", "=", true)
      .where("u.is_active", "=", true).where("p.is_available", "=", userFilter.isAvailable).execute();
    ids = available.map(row => row.user_uuid);
  }
  return Promise.allSettled(ids.map(recipientId => createNotification({
    ...input, recipientId, recipientRole: role,
    deduplicationKey: typeof input.deduplicationKey === "function" ? input.deduplicationKey(recipientId) : input.deduplicationKey,
  })));
}
