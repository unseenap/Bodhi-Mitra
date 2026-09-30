export type AssessmentBand = "low" | "moderate" | "high" | "urgent";

export interface AssessmentRecord {
  id: string;
  studentId: string;
  answers: boolean[];
  score: number;
  band: AssessmentBand;
  safetyFlag: boolean;
  completedAt: Date;
}

export interface AssessmentRepository {
  nextEligibleAt(studentUuid: string): Promise<Date | null>;
  listForStudent(studentUuid: string, limit?: number): Promise<AssessmentRecord[]>;
  create(input: { assessmentUuid: string; studentUuid: string; answers: boolean[]; completedAt?: Date }): Promise<AssessmentRecord>;
  distribution(): Promise<Array<{ band: AssessmentBand; count: number }>>;
}
