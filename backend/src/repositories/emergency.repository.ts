export type SessionMode = "chat" | "voice" | "video";
export type EmergencyStatus = "pending" | "matched" | "timeout" | "cancelled" | "ended";

export interface EmergencyRecord {
  id: string;
  internalId: string;
  studentId: string;
  anonId: string;
  mode: SessionMode;
  status: EmergencyStatus;
  mood: string | null;
  urgent: boolean;
  psychologistId: string | null;
  matchedAt: Date | null;
  timeoutAt: Date;
  createdAt: Date;
}

export interface EmergencyRepository {
  findActiveForStudent(studentUuid: string): Promise<EmergencyRecord | null>;
  create(input: { requestUuid: string; studentUuid: string; anonId: string; mode: SessionMode; mood?: string; urgent?: boolean; timeoutAt: Date }): Promise<EmergencyRecord>;
  listQueue(now?: Date, limit?: number): Promise<EmergencyRecord[]>;
  listStudentHistory(studentUuid: string, limit?: number): Promise<EmergencyRecord[]>;
  expire(requestUuid: string, now?: Date): Promise<boolean>;
}
