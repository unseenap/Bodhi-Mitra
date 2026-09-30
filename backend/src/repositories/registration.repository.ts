import type { SafeUser } from "./repository.types.js";

export interface PendingRegistrationInput {
  registrationUuid: string;
  fullName: string;
  rollNumber: string;
  email: string;
  mobileNumber: string;
  departmentCode: string;
  passwordHash: string;
  otpHash: string;
  otpExpiresAt: Date;
  expiresAt: Date;
}

export interface PendingRegistration extends PendingRegistrationInput {
  internalId: string;
  otpAttempts: number;
  createdAt: Date;
}

export interface RegistrationRepository {
  savePending(input: PendingRegistrationInput): Promise<PendingRegistration>;
  findPending(identifier: string, lock?: boolean): Promise<PendingRegistration | null>;
  incrementOtpAttempts(internalId: string, maximumAttempts: number): Promise<number>;
  completeStudentRegistration(internalId: string, userUuid: string): Promise<SafeUser>;
  deletePending(internalId: string): Promise<boolean>;
  deleteExpired(now?: Date): Promise<number>;
}
