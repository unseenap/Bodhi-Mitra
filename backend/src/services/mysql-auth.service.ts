import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { z } from "zod";
import { passwordLoginSchema, studentRegistrationSchema } from "@bodhi/shared";
import { env } from "../config/env.js";
import { getMysqlDatabase } from "../database/client.js";
import { MysqlRegistrationRepository, MysqlUserRepository } from "../repositories/mysql/index.js";
import type { SafeUser } from "../repositories/repository.types.js";
import { makeOtp } from "../utils/auth.js";
import { sendOtp } from "./email.service.js";

type StudentRegistrationInput = z.infer<typeof studentRegistrationSchema>;
type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;

export class MysqlAuthError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "MysqlAuthError";
  }
}

const MAX_OTP_ATTEMPTS = 5;
const dummyPasswordHash = bcrypt.hash("Bodhi-Mitra-dummy-password", 12);

function departmentCode(department: string) {
  const match = department.match(/\(([A-Za-z0-9]+)\)$/);
  if (!match) throw new MysqlAuthError("Unsupported department");
  return match[1]!;
}

export class MysqlAuthService {
  constructor(
    private readonly users = new MysqlUserRepository(),
    private readonly registrations = new MysqlRegistrationRepository(),
  ) {}

  async registerStudent(input: StudentRegistrationInput) {
    const data = studentRegistrationSchema.parse(input);
    const [emailOwner, rollOwner] = await Promise.all([
      this.users.findAuthByIdentifier(data.email),
      this.users.findAuthByIdentifier(data.rollNumber),
    ]);
    if (emailOwner || rollOwner)
      throw new MysqlAuthError("Unable to register with these details. Try signing in or contact support.", 409);
    const otp = makeOtp();
    const otpExpiresAt = new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60_000);
    await this.registrations.savePending({
      registrationUuid: randomUUID(), fullName: data.fullName,
      rollNumber: data.rollNumber, email: data.email, mobileNumber: data.mobileNumber,
      departmentCode: departmentCode(data.department),
      passwordHash: await bcrypt.hash(data.password, 12), otpHash: await bcrypt.hash(otp, 10),
      otpExpiresAt, expiresAt: otpExpiresAt,
    });
    await sendOtp(data.email, otp);
    return { message: "We emailed your 6-digit code", identifier: data.email };
  }

  async verifyPendingStudent(identifier: string, otp: string): Promise<SafeUser> {
    const db = getMysqlDatabase();
    return db.transaction().execute(async transaction => {
      const registrations = new MysqlRegistrationRepository(transaction);
      const pending = await registrations.findPending(identifier, true);
      if (!pending || pending.otpExpiresAt <= new Date()) {
        if (pending) await registrations.deletePending(pending.internalId);
        throw new MysqlAuthError("The code is invalid or expired", 401);
      }
      const valid = pending.otpAttempts < MAX_OTP_ATTEMPTS
        && await bcrypt.compare(otp, pending.otpHash);
      if (!valid) {
        const attempts = await registrations.incrementOtpAttempts(pending.internalId, MAX_OTP_ATTEMPTS);
        if (attempts >= MAX_OTP_ATTEMPTS) await registrations.deletePending(pending.internalId);
        throw new MysqlAuthError(
          attempts >= MAX_OTP_ATTEMPTS
            ? "Too many incorrect attempts. Request a new code."
            : "The code is invalid or expired",
          401,
        );
      }
      return registrations.completeStudentRegistration(pending.internalId, randomUUID());
    });
  }

  async requestStudentOtp(identifier: string) {
    const user = await this.users.findAuthByIdentifier(identifier, "student");
    if (user?.verified && user.isActive) {
      const otp = makeOtp();
      const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60_000);
      await this.users.setOtp(user.id, await bcrypt.hash(otp, 10), expiresAt);
      await sendOtp(user.email, otp);
    }
  }

  async verifyStudentOtp(identifier: string, otp: string) {
    const db = getMysqlDatabase();
    return db.transaction().execute(async transaction => {
      const users = new MysqlUserRepository(transaction);
      const user = await users.findAuthByIdentifier(identifier, "student", true);
      if (!user?.otpHash || !user.otpExpiresAt || user.otpExpiresAt <= new Date())
        throw new MysqlAuthError("The code is invalid or expired", 401);
      const valid = user.otpAttempts < MAX_OTP_ATTEMPTS
        && await bcrypt.compare(otp, user.otpHash);
      if (!valid) {
        const attempts = await users.incrementOtpAttempts(user.id, MAX_OTP_ATTEMPTS);
        throw new MysqlAuthError(
          attempts >= MAX_OTP_ATTEMPTS
            ? "Too many incorrect attempts. Request a new code."
            : "The code is invalid or expired",
          401,
        );
      }
      if (!await users.consumeOtp(user.id, user.otpHash))
        throw new MysqlAuthError("The code has already been used. Request a new code.", 401);
      return users.findByUuid(user.id).then(result => {
        if (!result) throw new MysqlAuthError("Account not found", 404);
        return result;
      });
    });
  }

  async resetStudentPassword(identifier: string, otp: string, newPassword: string) {
    const db = getMysqlDatabase();
    return db.transaction().execute(async transaction => {
      const users = new MysqlUserRepository(transaction);
      const user = await users.findAuthByIdentifier(identifier, "student", true);
      if (!user?.otpHash || !user.otpExpiresAt || user.otpExpiresAt <= new Date())
        throw new MysqlAuthError("The code is invalid or expired", 401);
      if (user.otpAttempts >= MAX_OTP_ATTEMPTS || !await bcrypt.compare(otp, user.otpHash)) {
        const attempts = await users.incrementOtpAttempts(user.id, MAX_OTP_ATTEMPTS);
        throw new MysqlAuthError(
          attempts >= MAX_OTP_ATTEMPTS
            ? "Too many incorrect attempts. Request a new code."
            : "The code is invalid or expired",
          401,
        );
      }
      await users.updatePassword(user.id, await bcrypt.hash(newPassword, 12), false);
      return user.id;
    });
  }

  async changePassword(userUuid: string, currentPassword: string, newPassword: string) {
    const user = await this.users.findByUuid(userUuid);
    if (!user) throw new MysqlAuthError("Account not found", 404);
    const auth = await this.users.findAuthByIdentifier(user.email, user.role);
    if (!auth?.passwordHash || !await bcrypt.compare(currentPassword, auth.passwordHash))
      throw new MysqlAuthError("Current password is incorrect", 401);
    await this.users.updatePassword(userUuid, await bcrypt.hash(newPassword, 12), false);
    const updated = await this.users.findByUuid(userUuid);
    if (!updated) throw new MysqlAuthError("Account not found", 404);
    return updated;
  }

  async currentUser(userUuid: string) {
    const user = await this.users.findByUuid(userUuid);
    if (!user?.verified || !user.isActive) throw new MysqlAuthError("Account not found", 404);
    return user;
  }

  async passwordLogin(input: PasswordLoginInput) {
    const data = passwordLoginSchema.parse(input);
    const identifier = data.role === "student" ? data.identifier! : data.email!;
    const user = await this.users.findAuthByIdentifier(identifier, data.role);
    const passwordMatches = await bcrypt.compare(
      data.password,
      user?.passwordHash ?? await dummyPasswordHash,
    );
    if (!user?.passwordHash || !user.verified || !user.isActive || !passwordMatches)
      throw new MysqlAuthError("Sign-in credentials are incorrect", 401);
    return user;
  }
}
