import type { NotificationChannel, NotificationPriority, NotificationRecord, NotificationRepository } from "../notification.repository.js";
import type { Page, UserRole } from "../repository.types.js";
import { RepositoryConflictError, RepositoryNotFoundError } from "../repository.types.js";
import { MysqlRepository, clampLimit, parseJson } from "./mysql.repository.js";

interface NotificationRow {
  internal_id: string; id: string; recipient_id: string; recipient_role: UserRole;
  type: string; title: string; message: string; priority: NotificationPriority;
  action_url: string | null; entity_type: string | null; entity_id: string | null;
  channels: NotificationChannel[] | string; read_at: Date | null;
  acknowledged_at: Date | null; expires_at: Date | null; created_at: Date;
}

interface NotificationCursor { createdAt: string; internalId: string }

function encodeCursor(row: NotificationRow) {
  return Buffer.from(JSON.stringify({
    createdAt: row.created_at.toISOString(), internalId: row.internal_id,
  })).toString("base64url");
}

function decodeCursor(value: string): NotificationCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as NotificationCursor;
    if (!parsed.createdAt || !/^\d+$/.test(parsed.internalId) || Number.isNaN(Date.parse(parsed.createdAt)))
      throw new Error("Invalid cursor fields");
    return parsed;
  } catch {
    throw new RepositoryConflictError("Invalid notification cursor");
  }
}

function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id, recipientId: row.recipient_id, recipientRole: row.recipient_role,
    type: row.type, title: row.title, message: row.message, priority: row.priority,
    actionUrl: row.action_url, entityType: row.entity_type, entityId: row.entity_id,
    channels: parseJson<NotificationChannel[]>(row.channels), readAt: row.read_at,
    acknowledgedAt: row.acknowledged_at, expiresAt: row.expires_at, createdAt: row.created_at,
  };
}

export class MysqlNotificationRepository extends MysqlRepository implements NotificationRepository {
  private baseQuery() {
    return this.db.selectFrom("notifications as n")
      .innerJoin("users as recipient", "recipient.id", "n.recipient_id")
      .select([
        "n.id as internal_id", "n.notification_uuid as id", "recipient.user_uuid as recipient_id",
        "n.recipient_role", "n.event_type as type", "n.title", "n.message", "n.priority",
        "n.action_url", "n.entity_type", "n.entity_id", "n.channels", "n.read_at",
        "n.acknowledged_at", "n.expires_at", "n.created_at",
      ]);
  }

  private async recipientInternalId(recipientUuid: string, role?: UserRole) {
    let query = this.db.selectFrom("users").select("id").where("user_uuid", "=", recipientUuid);
    if (role) query = query.where("role", "=", role);
    return (await query.executeTakeFirst())?.id ?? null;
  }

  async create(input: { notificationUuid: string; recipientUuid: string; recipientRole: UserRole; type: string; title: string; message: string; priority?: NotificationPriority; actionUrl?: string; entityType?: string; entityId?: string; channels: NotificationChannel[]; deduplicationKey: string; expiresAt?: Date }) {
    const recipientId = await this.recipientInternalId(input.recipientUuid, input.recipientRole);
    if (!recipientId) throw new RepositoryNotFoundError("Notification recipient not found");
    if (!input.channels.length) throw new RepositoryConflictError("At least one notification channel is required");
    try {
      await this.db.insertInto("notifications").values({
        notification_uuid: input.notificationUuid, recipient_id: recipientId,
        recipient_role: input.recipientRole, event_type: input.type,
        title: input.title, message: input.message, priority: input.priority ?? "normal",
        action_url: input.actionUrl ?? null, entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null, channels: JSON.stringify([...new Set(input.channels)]),
        deduplication_key: input.deduplicationKey, read_at: null, acknowledged_at: null,
        scheduled_at: null, delivered_at: null, expires_at: input.expiresAt ?? null,
      }).executeTakeFirstOrThrow();
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_DUP_ENTRY") throw error;
    }
    const row = await this.baseQuery().where("n.recipient_id", "=", recipientId)
      .where("n.deduplication_key", "=", input.deduplicationKey).executeTakeFirst();
    if (!row) throw new RepositoryNotFoundError("Notification was not created");
    return mapNotification(row as NotificationRow);
  }

  async list(recipientUuid: string, recipientRole: UserRole, options: { filter?: "all" | "unread" | "action_required"; cursor?: string; limit?: number } = {}): Promise<Page<NotificationRecord>> {
    const now = new Date();
    const limit = clampLimit(options.limit, 20, 50);
    let query = this.baseQuery().where("recipient.user_uuid", "=", recipientUuid)
      .where("n.recipient_role", "=", recipientRole)
      .where(eb => eb.or([eb("n.expires_at", "is", null), eb("n.expires_at", ">", now)]));
    if (options.filter === "unread") query = query.where("n.read_at", "is", null);
    if (options.filter === "action_required")
      query = query.where("n.read_at", "is", null).where("n.priority", "in", ["critical", "high"]);
    if (options.cursor) {
      const cursor = decodeCursor(options.cursor);
      const date = new Date(cursor.createdAt);
      query = query.where(eb => eb.or([
        eb("n.created_at", "<", date),
        eb.and([eb("n.created_at", "=", date), eb("n.id", "<", cursor.internalId)]),
      ]));
    }
    const rows = await query.orderBy("n.created_at", "desc").orderBy("n.id", "desc")
      .limit(limit + 1).execute() as NotificationRow[];
    const visible = rows.slice(0, limit);
    return {
      items: visible.map(mapNotification),
      nextCursor: rows.length > limit && visible.length ? encodeCursor(visible.at(-1)!) : null,
    };
  }

  async unreadCount(recipientUuid: string, recipientRole: UserRole) {
    const row = await this.db.selectFrom("notifications as n")
      .innerJoin("users as recipient", "recipient.id", "n.recipient_id")
      .select(eb => eb.fn.count<string>("n.id").as("count"))
      .where("recipient.user_uuid", "=", recipientUuid).where("n.recipient_role", "=", recipientRole)
      .where("n.read_at", "is", null)
      .where(eb => eb.or([eb("n.expires_at", "is", null), eb("n.expires_at", ">", new Date())]))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async markRead(notificationUuid: string, recipientUuid: string) {
    const recipientId = await this.recipientInternalId(recipientUuid);
    if (!recipientId) return false;
    const result = await this.db.updateTable("notifications").set({ read_at: new Date() })
      .where("notification_uuid", "=", notificationUuid).where("recipient_id", "=", recipientId)
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }

  async acknowledge(notificationUuid: string, recipientUuid: string) {
    const recipientId = await this.recipientInternalId(recipientUuid);
    if (!recipientId) return false;
    const now = new Date();
    const result = await this.db.updateTable("notifications").set({ read_at: now, acknowledged_at: now })
      .where("notification_uuid", "=", notificationUuid).where("recipient_id", "=", recipientId)
      .where("priority", "in", ["critical", "high"]).executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }

  async markAllRead(recipientUuid: string, recipientRole: UserRole) {
    const recipientId = await this.recipientInternalId(recipientUuid, recipientRole);
    if (!recipientId) return 0;
    const result = await this.db.updateTable("notifications").set({ read_at: new Date() })
      .where("recipient_id", "=", recipientId).where("recipient_role", "=", recipientRole)
      .where("read_at", "is", null).executeTakeFirst();
    return Number(result.numUpdatedRows);
  }
}
