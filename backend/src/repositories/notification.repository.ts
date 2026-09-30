import type { Page, UserRole } from "./repository.types.js";

export type NotificationPriority = "critical" | "high" | "normal" | "low";
export type NotificationChannel = "in_app" | "socket" | "push" | "email";

export interface NotificationRecord {
  id: string;
  recipientId: string;
  recipientRole: UserRole;
  type: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  channels: NotificationChannel[];
  readAt: Date | null;
  acknowledgedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface NotificationRepository {
  create(input: { notificationUuid: string; recipientUuid: string; recipientRole: UserRole; type: string; title: string; message: string; priority?: NotificationPriority; actionUrl?: string; entityType?: string; entityId?: string; channels: NotificationChannel[]; deduplicationKey: string; expiresAt?: Date }): Promise<NotificationRecord>;
  list(recipientUuid: string, recipientRole: UserRole, options?: { filter?: "all" | "unread" | "action_required"; cursor?: string; limit?: number }): Promise<Page<NotificationRecord>>;
  unreadCount(recipientUuid: string, recipientRole: UserRole): Promise<number>;
  markRead(notificationUuid: string, recipientUuid: string): Promise<boolean>;
  acknowledge(notificationUuid: string, recipientUuid: string): Promise<boolean>;
  markAllRead(recipientUuid: string, recipientRole: UserRole): Promise<number>;
}
