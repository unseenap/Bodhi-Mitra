import type { Selectable } from "kysely";
import type { UsersTable } from "../../database/types.js";
import type { UserListQuery, UserRepository } from "../user.repository.js";
import type { AuthUser, SafeUser, UserRole } from "../repository.types.js";
import { MysqlRepository, clampLimit } from "./mysql.repository.js";

type UserRow = Selectable<UsersTable>;

export function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.user_uuid,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    verified: Boolean(row.verified),
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MysqlUserRepository extends MysqlRepository implements UserRepository {
  async findByUuid(userUuid: string): Promise<SafeUser | null> {
    const row = await this.db.selectFrom("users").selectAll()
      .where("user_uuid", "=", userUuid).executeTakeFirst();
    return row ? toSafeUser(row) : null;
  }

  async findAuthByIdentifier(identifier: string, role?: UserRole, lock = false): Promise<AuthUser | null> {
    const normalizedEmail = identifier.trim().toLowerCase();
    const normalizedRoll = identifier.trim().toUpperCase();
    let query = this.db.selectFrom("users as u")
      .leftJoin("student_profiles as sp", "sp.user_id", "u.id")
      .selectAll("u")
      .where(eb => eb.or([
        eb("u.email", "=", normalizedEmail),
        eb("sp.roll_number", "=", normalizedRoll),
      ]));
    if (role) query = query.where("u.role", "=", role);
    if (lock) query = query.forUpdate();
    const row = await query.executeTakeFirst();
    if (!row) return null;
    return {
      ...toSafeUser(row),
      internalId: row.id,
      passwordHash: row.password_hash,
      otpHash: row.otp_hash,
      otpExpiresAt: row.otp_expires_at,
      otpAttempts: row.otp_attempts,
    };
  }

  async list(query: UserListQuery): Promise<SafeUser[]> {
    let builder = this.db.selectFrom("users").selectAll()
      .where("role", "=", query.role);
    if (query.active !== undefined)
      builder = builder.where("is_active", "=", query.active);
    if (query.search) {
      const term = `%${query.search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      builder = builder.where(eb => eb.or([
        eb("full_name", "like", term), eb("email", "like", term),
      ]));
    }
    const rows = await builder.orderBy("created_at", "desc")
      .limit(clampLimit(query.limit, 100)).execute();
    return rows.map(toSafeUser);
  }

  async listActiveIdsByRole(role: UserRole): Promise<string[]> {
    const rows = await this.db.selectFrom("users").select("user_uuid")
      .where("role", "=", role).where("verified", "=", true)
      .where("is_active", "=", true).execute();
    return rows.map(row => row.user_uuid);
  }

  async setOtp(userUuid: string, otpHash: string, expiresAt: Date) {
    const result = await this.db.updateTable("users").set({
      otp_hash: otpHash, otp_expires_at: expiresAt, otp_attempts: 0,
    }).where("user_uuid", "=", userUuid).where("verified", "=", true)
      .where("is_active", "=", true).executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }

  async incrementOtpAttempts(userUuid: string, maximumAttempts: number) {
    await this.db.updateTable("users").set(eb => ({
      otp_attempts: eb("otp_attempts", "+", 1),
    })).where("user_uuid", "=", userUuid).where("otp_attempts", "<", maximumAttempts)
      .executeTakeFirst();
    const row = await this.db.selectFrom("users").select("otp_attempts")
      .where("user_uuid", "=", userUuid).executeTakeFirst();
    return row?.otp_attempts ?? maximumAttempts;
  }

  async consumeOtp(userUuid: string, expectedHash: string, now = new Date()) {
    const result = await this.db.updateTable("users").set({
      otp_hash: null, otp_expires_at: null, otp_attempts: 0,
    }).where("user_uuid", "=", userUuid).where("otp_hash", "=", expectedHash)
      .where("otp_expires_at", ">", now).where("otp_attempts", "<", 5)
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }

  async updatePassword(userUuid: string, passwordHash: string, mustChangePassword: boolean) {
    const result = await this.db.updateTable("users").set({
      password_hash: passwordHash,
      must_change_password: mustChangePassword,
      otp_hash: null,
      otp_expires_at: null,
      otp_attempts: 0,
    }).where("user_uuid", "=", userUuid).executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }
}
