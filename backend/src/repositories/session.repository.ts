import type { SessionMode } from "./emergency.repository.js";

export interface SessionRecord {
  id: string;
  internalId: string;
  requestId: string;
  mode: SessionMode;
  studentId: string;
  psychologistId: string;
  startedAt: Date;
  endedAt: Date | null;
  rating: number | null;
  feedbackSubmittedAt: Date | null;
}

export interface SessionRepository {
  findParticipant(sessionUuid: string, userUuid: string, activeOnly?: boolean): Promise<SessionRecord | null>;
  listForStudent(studentUuid: string, limit?: number): Promise<SessionRecord[]>;
  listForPsychologist(psychologistUuid: string, limit?: number): Promise<SessionRecord[]>;
  saveFeedback(sessionUuid: string, studentUuid: string, rating: number, feedbackText?: string): Promise<boolean>;
  end(sessionUuid: string, endedAt?: Date): Promise<boolean>;
}
