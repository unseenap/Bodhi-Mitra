import { describe, expect, it } from "vitest";
import { departments, studentRegistrationSchema } from "./index";

const validStudent = { fullName: "Test Student", rollNumber: "235UCS006", email: "student@example.edu", mobileNumber: "+919000000000", department: departments[2] };

describe("GBU student registration", () => {
  it.each(["235UCS006", "225UCD007", "225UBT007", "225UCM007"])("accepts the 9-character roll number %s", rollNumber => { expect(studentRegistrationSchema.safeParse({ ...validStudent, rollNumber }).success).toBe(true); });
  it.each(["23UCS006", "235UC006", "235UCS0006", "235UC-006"])("rejects invalid roll number %s", rollNumber => { expect(studentRegistrationSchema.safeParse({ ...validStudent, rollNumber }).success).toBe(false); });
  it("requires one of the eight configured departments", () => { expect(departments).toHaveLength(8); expect(studentRegistrationSchema.safeParse({ ...validStudent, department: "Unknown" }).success).toBe(false); });
});
