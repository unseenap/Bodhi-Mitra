import type { Kysely, Transaction } from "kysely";
import type { Database } from "../database/types.js";

export type UserRole = "student" | "psychologist" | "admin";
export type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface SafeUser {
  id: string;
  role: UserRole;
  fullName: string | null;
  email: string;
  verified: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser extends SafeUser {
  internalId: string;
  passwordHash: string | null;
  otpHash: string | null;
  otpExpiresAt: Date | null;
  otpAttempts: number;
}

export class RepositoryConflictError extends Error {
  constructor(message = "The record conflicts with existing data") {
    super(message);
    this.name = "RepositoryConflictError";
  }
}

export class RepositoryNotFoundError extends Error {
  constructor(message = "The requested record was not found") {
    super(message);
    this.name = "RepositoryNotFoundError";
  }
}
