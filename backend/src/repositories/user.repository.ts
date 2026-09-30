import type { AuthUser, SafeUser, UserRole } from "./repository.types.js";

export interface UserListQuery {
  role: UserRole;
  search?: string;
  active?: boolean;
  limit?: number;
}

export interface UserRepository {
  findByUuid(userUuid: string): Promise<SafeUser | null>;
  findAuthByIdentifier(identifier: string, role?: UserRole, lock?: boolean): Promise<AuthUser | null>;
  list(query: UserListQuery): Promise<SafeUser[]>;
  listActiveIdsByRole(role: UserRole): Promise<string[]>;
  setOtp(userUuid: string, otpHash: string, expiresAt: Date): Promise<boolean>;
  incrementOtpAttempts(userUuid: string, maximumAttempts: number): Promise<number>;
  consumeOtp(userUuid: string, expectedHash: string, now?: Date): Promise<boolean>;
  updatePassword(userUuid: string, passwordHash: string, mustChangePassword: boolean): Promise<boolean>;
}
