import type { EmergencyRecord, EmergencyRepository, EmergencyStatus, SessionMode } from "../emergency.repository.js";
import { RepositoryConflictError, RepositoryNotFoundError } from "../repository.types.js";
import { MysqlRepository, clampLimit } from "./mysql.repository.js";

interface EmergencyRow {
  internal_id: string;
  id: string;
  student_id: string;
  anon_id: string;
  mode: SessionMode;
  status: EmergencyStatus;
  mood: string | null;
  urgent: boolean;
  psychologist_id: string | null;
  matched_at: Date | null;
  timeout_at: Date;
  created_at: Date;
}

type EmergencyMood = "Anxious" | "Depressed" | "Overwhelmed" | "Angry" | "Confused" | "Just need to talk";
const emergencyMoods: EmergencyMood[] = [
  "Anxious", "Depressed", "Overwhelmed", "Angry", "Confused", "Just need to talk",
];

function mapEmergency(row: EmergencyRow): EmergencyRecord {
  return {
    id: row.id, internalId: row.internal_id, studentId: row.student_id,
    anonId: row.anon_id, mode: row.mode, status: row.status, mood: row.mood,
    urgent: Boolean(row.urgent), psychologistId: row.psychologist_id,
    matchedAt: row.matched_at, timeoutAt: row.timeout_at, createdAt: row.created_at,
  };
}

export class MysqlEmergencyRepository extends MysqlRepository implements EmergencyRepository {
  private baseQuery() {
    return this.db.selectFrom("emergency_requests as e")
      .innerJoin("users as student", "student.id", "e.student_id")
      .leftJoin("users as psychologist", "psychologist.id", "e.psychologist_id")
      .select([
        "e.id as internal_id", "e.request_uuid as id", "student.user_uuid as student_id",
        "e.anon_id", "e.mode", "e.status", "e.mood", "e.urgent",
        "psychologist.user_uuid as psychologist_id", "e.matched_at", "e.timeout_at", "e.created_at",
      ]);
  }

  async findActiveForStudent(studentUuid: string) {
    const row = await this.baseQuery().where("student.user_uuid", "=", studentUuid)
      .where("e.status", "in", ["pending", "matched"]).executeTakeFirst();
    return row ? mapEmergency(row as EmergencyRow) : null;
  }

  async create(input: { requestUuid: string; studentUuid: string; anonId: string; mode: SessionMode; mood?: string; urgent?: boolean; timeoutAt: Date }) {
    const student = await this.db.selectFrom("users").select("id")
      .where("user_uuid", "=", input.studentUuid).where("role", "=", "student")
      .where("verified", "=", true).where("is_active", "=", true).executeTakeFirst();
    if (!student) throw new RepositoryNotFoundError("Active student account not found");
    const mood = input.mood === undefined ? null : emergencyMoods.find(value => value === input.mood);
    if (input.mood !== undefined && !mood) throw new RepositoryConflictError("Unsupported emergency mood");
    try {
      await this.db.insertInto("emergency_requests").values({
        request_uuid: input.requestUuid, student_id: student.id, anon_id: input.anonId,
        mode: input.mode, status: "pending", mood,
        urgent: input.urgent ?? false, psychologist_id: null, matched_at: null,
        timeout_at: input.timeoutAt,
      }).executeTakeFirstOrThrow();
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new RepositoryConflictError("Student already has a live emergency request");
      throw error;
    }
    const created = await this.baseQuery().where("e.request_uuid", "=", input.requestUuid).executeTakeFirst();
    if (!created) throw new RepositoryNotFoundError("Emergency request was not created");
    return mapEmergency(created as EmergencyRow);
  }

  async listQueue(now = new Date(), limit = 100) {
    const rows = await this.baseQuery().where("e.status", "=", "pending")
      .where("e.timeout_at", ">", now).orderBy("e.urgent", "desc")
      .orderBy("e.created_at").limit(clampLimit(limit, 100)).execute();
    return rows.map(row => mapEmergency(row as EmergencyRow));
  }

  async listStudentHistory(studentUuid: string, limit = 50) {
    const rows = await this.baseQuery().where("student.user_uuid", "=", studentUuid)
      .orderBy("e.created_at", "desc").limit(clampLimit(limit, 50)).execute();
    return rows.map(row => mapEmergency(row as EmergencyRow));
  }

  async expire(requestUuid: string, now = new Date()) {
    const result = await this.db.updateTable("emergency_requests").set({ status: "timeout" })
      .where("request_uuid", "=", requestUuid).where("status", "=", "pending")
      .where("timeout_at", "<=", now).executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }
}
