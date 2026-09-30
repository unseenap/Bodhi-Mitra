import type { UserRole } from "./repository.types.js";

export interface AuditRecord {
  id: string;
  action: string;
  actorId: string | null;
  actorRole: UserRole | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  resolved: boolean;
  createdAt: Date;
}

export interface AuditRepository {
  create(input: { auditUuid: string; action: string; actorUuid?: string; actorRole?: UserRole; targetType?: string; targetId?: string; metadata?: Record<string, unknown> }): Promise<AuditRecord>;
  listReports(status?: "pending" | "resolved", limit?: number): Promise<AuditRecord[]>;
  resolve(auditUuid: string, resolverUuid: string, at?: Date): Promise<boolean>;
}
