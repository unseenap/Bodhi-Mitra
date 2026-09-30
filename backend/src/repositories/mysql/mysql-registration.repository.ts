import type { Selectable } from "kysely";
import type { Database, PendingStudentRegistrationsTable } from "../../database/types.js";
import type { PendingRegistration, PendingRegistrationInput, RegistrationRepository } from "../registration.repository.js";
import { RepositoryConflictError, RepositoryNotFoundError, type DatabaseExecutor, type SafeUser } from "../repository.types.js";
import { MysqlRepository } from "./mysql.repository.js";
import { toSafeUser } from "./mysql-user.repository.js";

type PendingRow = Selectable<PendingStudentRegistrationsTable>;

function mapPending(row: PendingRow, departmentCode: string): PendingRegistration {
  return {
    internalId: row.id,
    registrationUuid: row.registration_uuid,
    fullName: row.full_name,
    rollNumber: row.roll_number,
    email: row.email,
    mobileNumber: row.mobile_number,
    departmentCode,
    passwordHash: row.password_hash,
    otpHash: row.otp_hash,
    otpExpiresAt: row.otp_expires_at,
    otpAttempts: row.otp_attempts,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export class MysqlRegistrationRepository extends MysqlRepository implements RegistrationRepository {
  async savePending(input: PendingRegistrationInput): Promise<PendingRegistration> {
    const department = await this.db.selectFrom("departments").select(["id", "code"])
      .where("code", "=", input.departmentCode).where("is_active", "=", true)
      .executeTakeFirst();
    if (!department) throw new RepositoryNotFoundError("Department not found");
    const existing = await this.db.selectFrom("pending_student_registrations").select(["id"])
      .where(eb => eb.or([
        eb("email", "=", input.email.toLowerCase()),
        eb("roll_number", "=", input.rollNumber.toUpperCase()),
      ])).executeTakeFirst();
    const values = {
      registration_uuid: input.registrationUuid,
      full_name: input.fullName,
      roll_number: input.rollNumber.toUpperCase(),
      email: input.email.toLowerCase(),
      mobile_number: input.mobileNumber,
      department_id: department.id,
      password_hash: input.passwordHash,
      otp_hash: input.otpHash,
      otp_expires_at: input.otpExpiresAt,
      otp_attempts: 0,
      expires_at: input.expiresAt,
    };
    try {
      if (existing) {
        await this.db.updateTable("pending_student_registrations").set(values)
          .where("id", "=", existing.id).executeTakeFirstOrThrow();
      } else {
        await this.db.insertInto("pending_student_registrations").values(values).executeTakeFirstOrThrow();
      }
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new RepositoryConflictError("Email or roll number is already pending");
      throw error;
    }
    const saved = await this.findPending(input.email);
    if (!saved) throw new RepositoryNotFoundError("Pending registration was not saved");
    return saved;
  }

  async findPending(identifier: string, lock = false): Promise<PendingRegistration | null> {
    let query = this.db.selectFrom("pending_student_registrations as p")
      .innerJoin("departments as d", "d.id", "p.department_id")
      .selectAll("p").select("d.code as department_code")
      .where(eb => eb.or([
        eb("p.email", "=", identifier.trim().toLowerCase()),
        eb("p.roll_number", "=", identifier.trim().toUpperCase()),
      ]));
    if (lock) query = query.forUpdate();
    const row = await query.executeTakeFirst();
    return row ? mapPending(row, row.department_code) : null;
  }

  async incrementOtpAttempts(internalId: string, maximumAttempts: number) {
    await this.db.updateTable("pending_student_registrations")
      .set(eb => ({ otp_attempts: eb("otp_attempts", "+", 1) }))
      .where("id", "=", internalId).where("otp_attempts", "<", maximumAttempts)
      .executeTakeFirst();
    const row = await this.db.selectFrom("pending_student_registrations")
      .select("otp_attempts").where("id", "=", internalId).executeTakeFirst();
    return row?.otp_attempts ?? maximumAttempts;
  }

  async completeStudentRegistration(internalId: string, userUuid: string): Promise<SafeUser> {
    const complete = async (transaction: DatabaseExecutor) => {
      const repository = new MysqlRegistrationRepository(transaction);
      const pending = await transaction.selectFrom("pending_student_registrations as p")
        .innerJoin("departments as d", "d.id", "p.department_id")
        .selectAll("p").select("d.code as department_code")
        .where("p.id", "=", internalId).forUpdate().executeTakeFirst();
      if (!pending || pending.expires_at <= new Date())
        throw new RepositoryNotFoundError("Pending registration expired or was not found");
      try {
        const inserted = await transaction.insertInto("users").values({
          user_uuid: userUuid,
          role: "student",
          full_name: pending.full_name,
          email: pending.email,
          password_hash: pending.password_hash,
          otp_hash: null,
          otp_expires_at: null,
          otp_attempts: 0,
          verified: true,
          is_active: true,
          must_change_password: false,
        }).executeTakeFirstOrThrow();
        const userId = String(inserted.insertId);
        await transaction.insertInto("student_profiles").values({
          user_id: userId,
          roll_number: pending.roll_number,
          mobile_number: pending.mobile_number,
          department_id: pending.department_id,
          assessment_next_eligible_at: null,
        }).executeTakeFirstOrThrow();
        await repository.deletePending(internalId);
        const row = await transaction.selectFrom("users").selectAll()
          .where("id", "=", userId).executeTakeFirstOrThrow();
        return toSafeUser(row);
      } catch (error) {
        if ((error as { code?: string }).code === "ER_DUP_ENTRY")
          throw new RepositoryConflictError("Student account already exists");
        throw error;
      }
    };
    if (this.db.isTransaction) return complete(this.db);
    return this.db.transaction().execute(complete);
  }

  async deletePending(internalId: string) {
    const result = await this.db.deleteFrom("pending_student_registrations")
      .where("id", "=", internalId).executeTakeFirst();
    return result.numDeletedRows === 1n;
  }

  async deleteExpired(now = new Date()) {
    const result = await this.db.deleteFrom("pending_student_registrations")
      .where("expires_at", "<=", now).executeTakeFirst();
    return Number(result.numDeletedRows);
  }
}
