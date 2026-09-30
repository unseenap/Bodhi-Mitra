import { randomUUID } from "node:crypto";
import type { Transaction } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyMysql, initializeMysql } from "../src/database/client.js";
import type { Database } from "../src/database/types.js";
import { MysqlNotificationRepository, MysqlRegistrationRepository, MysqlUserRepository } from "../src/repositories/mysql/index.js";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
const live = describe.runIf(enabled);
class RollbackFixture extends Error {}

async function withRollback(run: (transaction: Transaction<Database>) => Promise<void>) {
  const db = await initializeMysql();
  try {
    await db.transaction().execute(async transaction => {
      await run(transaction);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
}

function userValues(userUuid: string, email: string) {
  return {
    user_uuid: userUuid,
    role: "admin" as const,
    full_name: "Repository Fixture",
    email,
    password_hash: "fixture-hash-not-a-real-password",
    otp_hash: null,
    otp_expires_at: null,
    otp_attempts: 0,
    verified: true,
    is_active: true,
    must_change_password: false,
  };
}

live("MySQL repository integration", () => {
  beforeAll(() => initializeMysql(), 20_000);
  afterAll(() => destroyMysql());

  it("rolls repository writes back atomically", async () => {
    const userUuid = randomUUID();
    const email = `rollback-${userUuid}@example.edu`;
    await withRollback(async transaction => {
      await transaction.insertInto("users").values(userValues(userUuid, email)).executeTakeFirstOrThrow();
      const repository = new MysqlUserRepository(transaction);
      expect((await repository.findByUuid(userUuid))?.email).toBe(email);
    });
    const db = await initializeMysql();
    expect(await db.selectFrom("users").select("id").where("user_uuid", "=", userUuid).executeTakeFirst()).toBeUndefined();
  }, 20_000);

  it("enforces case-insensitive unique email and profile foreign keys", async () => {
    await withRollback(async transaction => {
      const suffix = randomUUID();
      await transaction.insertInto("users").values(userValues(randomUUID(), `Case-${suffix}@example.edu`)).executeTakeFirstOrThrow();
      await expect(transaction.insertInto("users").values(
        userValues(randomUUID(), `case-${suffix}@EXAMPLE.EDU`),
      ).executeTakeFirstOrThrow()).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
      await expect(transaction.insertInto("student_profiles").values({
        user_id: "999999999999999", roll_number: "235UCS999", mobile_number: "+919999999999",
        department_id: 1, assessment_next_eligible_at: null,
      }).executeTakeFirstOrThrow()).rejects.toMatchObject({ code: "ER_SIGNAL_EXCEPTION" });
      const now = new Date();
      await expect(transaction.insertInto("pending_student_registrations").values({
        registration_uuid: randomUUID(), full_name: "Foreign Key Fixture",
        roll_number: "235UCS998", email: `fk-${suffix}@example.edu`,
        mobile_number: "+919999999998", department_id: 65535,
        password_hash: "fixture-hash", otp_hash: "fixture-otp-hash",
        otp_expires_at: new Date(now.getTime() + 60_000), otp_attempts: 0,
        expires_at: new Date(now.getTime() + 120_000),
      }).executeTakeFirstOrThrow()).rejects.toMatchObject({ code: "ER_NO_REFERENCED_ROW_2" });
    });
  }, 20_000);

  it("paginates notifications deterministically and scopes them by recipient", async () => {
    await withRollback(async transaction => {
      const recipientUuid = randomUUID();
      await transaction.insertInto("users").values(
        userValues(recipientUuid, `notify-${recipientUuid}@example.edu`),
      ).executeTakeFirstOrThrow();
      const repository = new MysqlNotificationRepository(transaction);
      for (let index = 0; index < 3; index += 1) {
        await repository.create({
          notificationUuid: randomUUID(), recipientUuid, recipientRole: "admin",
          type: "repository.fixture", title: `Fixture ${index}`, message: "Safe integration fixture",
          channels: ["in_app"], deduplicationKey: `fixture:${index}`,
        });
      }
      const first = await repository.list(recipientUuid, "admin", { limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).toBeTruthy();
      const second = await repository.list(recipientUuid, "admin", { limit: 2, cursor: first.nextCursor! });
      expect(second.items).toHaveLength(1);
      expect(new Set([...first.items, ...second.items].map(item => item.id)).size).toBe(3);
    });
  }, 20_000);

  it("atomically promotes a pending registration into a verified student", async () => {
    await withRollback(async transaction => {
      const registrationUuid = randomUUID();
      const userUuid = randomUUID();
      const department = await transaction.selectFrom("departments").select("id")
        .where("code", "=", "SoICT").executeTakeFirstOrThrow();
      const inserted = await transaction.insertInto("pending_student_registrations").values({
        registration_uuid: registrationUuid, full_name: "Student Fixture",
        roll_number: "999UCS997", email: `student-${userUuid}@example.edu`,
        mobile_number: "+919999999997", department_id: department.id,
        password_hash: "fixture-password-hash", otp_hash: "fixture-otp-hash",
        otp_expires_at: new Date(Date.now() + 60_000), otp_attempts: 0,
        expires_at: new Date(Date.now() + 120_000),
      }).executeTakeFirstOrThrow();
      const pendingId = String(inserted.insertId);
      const repository = new MysqlRegistrationRepository(transaction);
      const student = await repository.completeStudentRegistration(pendingId, userUuid);
      expect(student).toMatchObject({ id: userUuid, role: "student", verified: true });
      expect(await transaction.selectFrom("student_profiles as profile")
        .innerJoin("users as user", "user.id", "profile.user_id")
        .select("profile.roll_number").where("user.user_uuid", "=", userUuid)
        .executeTakeFirst()).toEqual({ roll_number: "999UCS997" });
      expect(await transaction.selectFrom("pending_student_registrations").select("id")
        .where("id", "=", pendingId).executeTakeFirst()).toBeUndefined();
    });
  }, 20_000);
});
