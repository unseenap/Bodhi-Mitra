import type { SessionMode } from "../emergency.repository.js";
import type { SessionRecord, SessionRepository } from "../session.repository.js";
import { MysqlRepository, clampLimit } from "./mysql.repository.js";

interface SessionRow {
  internal_id: string; id: string; request_id: string; mode: SessionMode;
  student_id: string; psychologist_id: string; started_at: Date; ended_at: Date | null;
  rating: number | null; feedback_submitted_at: Date | null;
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id, internalId: row.internal_id, requestId: row.request_id, mode: row.mode,
    studentId: row.student_id, psychologistId: row.psychologist_id,
    startedAt: row.started_at, endedAt: row.ended_at, rating: row.rating,
    feedbackSubmittedAt: row.feedback_submitted_at,
  };
}

export class MysqlSessionRepository extends MysqlRepository implements SessionRepository {
  private baseQuery() {
    return this.db.selectFrom("sessions as s")
      .innerJoin("emergency_requests as e", "e.id", "s.request_id")
      .innerJoin("users as student", "student.id", "s.student_id")
      .innerJoin("users as psychologist", "psychologist.id", "s.psychologist_id")
      .select([
        "s.id as internal_id", "s.session_uuid as id", "e.request_uuid as request_id", "s.mode",
        "student.user_uuid as student_id", "psychologist.user_uuid as psychologist_id",
        "s.started_at", "s.ended_at", "s.rating", "s.feedback_submitted_at",
      ]);
  }

  async findParticipant(sessionUuid: string, userUuid: string, activeOnly = false) {
    let query = this.baseQuery().where("s.session_uuid", "=", sessionUuid)
      .where(eb => eb.or([
        eb("student.user_uuid", "=", userUuid), eb("psychologist.user_uuid", "=", userUuid),
      ]));
    if (activeOnly) query = query.where("s.ended_at", "is", null);
    const row = await query.executeTakeFirst();
    return row ? mapSession(row as SessionRow) : null;
  }

  async listForStudent(studentUuid: string, limit = 50) {
    const rows = await this.baseQuery().where("student.user_uuid", "=", studentUuid)
      .orderBy("s.started_at", "desc").limit(clampLimit(limit, 50)).execute();
    return rows.map(row => mapSession(row as SessionRow));
  }

  async listForPsychologist(psychologistUuid: string, limit = 50) {
    const rows = await this.baseQuery().where("psychologist.user_uuid", "=", psychologistUuid)
      .orderBy("s.started_at", "desc").limit(clampLimit(limit, 50)).execute();
    return rows.map(row => mapSession(row as SessionRow));
  }

  async saveFeedback(sessionUuid: string, studentUuid: string, rating: number, feedbackText?: string) {
    const now = new Date();
    const result = await this.db.updateTable("sessions")
      .set({ rating, feedback_text: feedbackText?.trim() || null, feedback_submitted_at: now })
      .where("session_uuid", "=", sessionUuid).where("student_id", "=", this.db.selectFrom("users").select("id").where("user_uuid", "=", studentUuid))
      .where("ended_at", "is not", null).where("feedback_submitted_at", "is", null)
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }

  async end(sessionUuid: string, endedAt = new Date()) {
    const result = await this.db.updateTable("sessions").set({ ended_at: endedAt })
      .where("session_uuid", "=", sessionUuid).where("ended_at", "is", null)
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }
}
