import type { AuditRecord, AuditRepository } from "../audit.repository.js";
import type { UserRole } from "../repository.types.js";
import { RepositoryNotFoundError } from "../repository.types.js";
import { MysqlRepository, clampLimit, parseJson } from "./mysql.repository.js";

interface AuditRow {
  id: string; action: string; actor_id: string | null; actor_role: UserRole | null;
  target_type: string | null; target_id: string | null;
  metadata: Record<string, unknown> | string | null; resolved: boolean; created_at: Date;
}

function mapAudit(row: AuditRow): AuditRecord {
  return {
    id: row.id, action: row.action, actorId: row.actor_id, actorRole: row.actor_role,
    targetType: row.target_type, targetId: row.target_id,
    metadata: row.metadata === null ? null : parseJson<Record<string, unknown>>(row.metadata),
    resolved: Boolean(row.resolved), createdAt: row.created_at,
  };
}

export class MysqlAuditRepository extends MysqlRepository implements AuditRepository {
  private baseQuery() {
    return this.db.selectFrom("audit_logs as a")
      .leftJoin("users as actor", "actor.id", "a.actor_id")
      .select([
        "a.audit_uuid as id", "a.action", "actor.user_uuid as actor_id", "a.actor_role",
        "a.target_type", "a.target_id", "a.metadata", "a.resolved", "a.created_at",
      ]);
  }

  async create(input: { auditUuid: string; action: string; actorUuid?: string; actorRole?: UserRole; targetType?: string; targetId?: string; metadata?: Record<string, unknown> }) {
    let actorId: string | null = null;
    if (input.actorUuid) {
      const actor = await this.db.selectFrom("users").select("id")
        .where("user_uuid", "=", input.actorUuid).executeTakeFirst();
      if (!actor) throw new RepositoryNotFoundError("Audit actor not found");
      actorId = actor.id;
    }
    await this.db.insertInto("audit_logs").values({
      audit_uuid: input.auditUuid, action: input.action, actor_id: actorId,
      actor_role: input.actorRole ?? null, target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      resolved: false, resolved_at: null, resolved_by: null,
    }).executeTakeFirstOrThrow();
    const row = await this.baseQuery().where("a.audit_uuid", "=", input.auditUuid).executeTakeFirstOrThrow();
    return mapAudit(row as AuditRow);
  }

  async listReports(status?: "pending" | "resolved", limit = 200) {
    let query = this.baseQuery();
    if (status) query = query.where("a.resolved", "=", status === "resolved");
    const rows = await query.orderBy("a.created_at", "desc").limit(clampLimit(limit, 200)).execute();
    return rows.map(row => mapAudit(row as AuditRow));
  }

  async resolve(auditUuid: string, resolverUuid: string, at = new Date()) {
    const resolver = await this.db.selectFrom("users").select("id")
      .where("user_uuid", "=", resolverUuid).where("role", "=", "admin").executeTakeFirst();
    if (!resolver) throw new RepositoryNotFoundError("Admin resolver not found");
    const result = await this.db.updateTable("audit_logs").set({
      resolved: true, resolved_at: at, resolved_by: resolver.id,
    }).where("audit_uuid", "=", auditUuid).where("resolved", "=", false).executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }
}
