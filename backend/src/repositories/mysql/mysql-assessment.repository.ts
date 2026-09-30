import type { AssessmentBand, AssessmentRecord, AssessmentRepository } from "../assessment.repository.js";
import { RepositoryConflictError, RepositoryNotFoundError } from "../repository.types.js";
import { MysqlRepository, clampLimit, parseJson } from "./mysql.repository.js";

interface AssessmentRow {
  id: string; student_id: string; answers: boolean[] | string; score: number;
  band: AssessmentBand; safety_flag: boolean; completed_at: Date;
}

function mapAssessment(row: AssessmentRow): AssessmentRecord {
  return {
    id: row.id, studentId: row.student_id, answers: parseJson<boolean[]>(row.answers),
    score: row.score, band: row.band, safetyFlag: Boolean(row.safety_flag),
    completedAt: row.completed_at,
  };
}

export class MysqlAssessmentRepository extends MysqlRepository implements AssessmentRepository {
  private baseQuery() {
    return this.db.selectFrom("assessments as a")
      .innerJoin("users as student", "student.id", "a.student_id")
      .select([
        "a.assessment_uuid as id", "student.user_uuid as student_id", "a.answers",
        "a.score", "a.band", "a.safety_flag", "a.completed_at",
      ]);
  }

  async nextEligibleAt(studentUuid: string) {
    const row = await this.db.selectFrom("student_profiles as p")
      .innerJoin("users as u", "u.id", "p.user_id")
      .select("p.assessment_next_eligible_at").where("u.user_uuid", "=", studentUuid)
      .executeTakeFirst();
    return row?.assessment_next_eligible_at ?? null;
  }

  async listForStudent(studentUuid: string, limit = 24) {
    const rows = await this.baseQuery().where("student.user_uuid", "=", studentUuid)
      .orderBy("a.completed_at", "desc").limit(clampLimit(limit, 24)).execute();
    return rows.map(row => mapAssessment(row as AssessmentRow));
  }

  async create(input: { assessmentUuid: string; studentUuid: string; answers: boolean[]; completedAt?: Date }) {
    if (input.answers.length !== 20) throw new RepositoryConflictError("Exactly 20 answers are required");
    const student = await this.db.selectFrom("users").select("id")
      .where("user_uuid", "=", input.studentUuid).where("role", "=", "student")
      .executeTakeFirst();
    if (!student) throw new RepositoryNotFoundError("Student not found");
    try {
      await this.db.insertInto("assessments").values({
        assessment_uuid: input.assessmentUuid, student_id: student.id,
        answers: JSON.stringify(input.answers), score: 0, band: "low", safety_flag: false,
        completed_at: input.completedAt ?? new Date(),
      }).executeTakeFirstOrThrow();
    } catch (error) {
      if (["ER_SIGNAL_EXCEPTION", "ER_DUP_ENTRY"].includes((error as { code?: string }).code ?? ""))
        throw new RepositoryConflictError("Student is not eligible for another assessment");
      throw error;
    }
    const row = await this.baseQuery().where("a.assessment_uuid", "=", input.assessmentUuid).executeTakeFirst();
    if (!row) throw new RepositoryNotFoundError("Assessment was not created");
    return mapAssessment(row as AssessmentRow);
  }

  async distribution() {
    const rows = await this.db.selectFrom("assessments").select("band")
      .select(eb => eb.fn.count<string>("id").as("count")).groupBy("band").execute();
    return rows.map(row => ({ band: row.band, count: Number(row.count) }));
  }
}
