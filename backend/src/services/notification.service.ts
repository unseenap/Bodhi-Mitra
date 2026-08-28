import type { Role } from "@bodhi/shared";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { sendPushToUser } from "./push.service.js";

export type NotificationPriority = "critical" | "high" | "normal" | "low";
export type NotificationChannel = "in_app" | "socket" | "push" | "email";

export type NotificationInput = {
  recipientId: string;
  recipientRole: Role;
  type: string;
  title: string;
  message: string;
  priority?: NotificationPriority;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  channels?: NotificationChannel[];
  deduplicationKey: string;
  expiresAt?: Date;
};

type NotificationEmitter = (recipientId: string, payload: Record<string, unknown>) => void;
let emitNotification: NotificationEmitter | null = null;

export function setNotificationEmitter(emitter: NotificationEmitter) {
  emitNotification = emitter;
}

function assertInternalActionUrl(value?: string) {
  if (!value) return;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    throw new Error("Notification action URL must be an internal application path");
  }
}

export function toSafeNotification(record: any) {
  return {
    id: String(record._id),
    type: record.type,
    title: record.title,
    message: record.message,
    priority: record.priority,
    actionUrl: record.actionUrl,
    readAt: record.readAt,
    acknowledgedAt: record.acknowledgedAt,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt
  };
}

export async function createNotification(input: NotificationInput) {
  assertInternalActionUrl(input.actionUrl);
  const channels = [...new Set(input.channels ?? ["in_app", "socket"])] as NotificationChannel[];
  let record;
  let created = false;
  try {
    record = await Notification.create({ ...input, priority: input.priority ?? "normal", channels });
    created = true;
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    record = await Notification.findOne({ recipientId: input.recipientId, deduplicationKey: input.deduplicationKey });
    if (!record) throw error;
  }

  if (!created) return record;
  const safe = toSafeNotification(record);
  if (channels.includes("socket")) emitNotification?.(input.recipientId, safe);
  if (channels.includes("push")) {
    void sendPushToUser(input.recipientId, {
      title: input.title,
      body: input.message,
      url: input.actionUrl ?? `/${input.recipientRole}`,
      tag: `${input.type}:${input.entityId ?? record.id}`
    });
  }
  return record;
}

export async function createNotificationForRole(
  role: Role,
  input: Omit<NotificationInput, "recipientId" | "recipientRole" | "deduplicationKey"> & {
    deduplicationKey: string | ((recipientId: string) => string);
  },
  userFilter: Record<string, unknown> = {}
) {
  const users = await User.find({ role, verified: true, isActive: true, ...userFilter }).select("_id").lean();
  return Promise.allSettled(users.map(user => {
    const recipientId = String(user._id);
    return createNotification({
      ...input,
      recipientId,
      recipientRole: role,
      deduplicationKey: typeof input.deduplicationKey === "function"
        ? input.deduplicationKey(recipientId)
        : input.deduplicationKey
    });
  }));
}
