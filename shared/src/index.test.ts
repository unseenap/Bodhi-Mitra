import { describe, expect, it } from "vitest";
import { departments, emergencyRequestSchema, passwordChangeSchema, sessionMessageSchema, sessionSignalSchema, studentRegistrationSchema } from "./index";

const validStudent = { fullName: "Test Student", rollNumber: "235UCS006", email: "student@example.edu", mobileNumber: "+919000000000", department: departments[2] };

describe("GBU student registration", () => {
  it.each(["235UCS006", "225UCD007", "225UBT007", "225UCM007"])("accepts the 9-character roll number %s", rollNumber => { expect(studentRegistrationSchema.safeParse({ ...validStudent, rollNumber }).success).toBe(true); });
  it.each(["23UCS006", "235UC006", "235UCS0006", "235UC-006"])("rejects invalid roll number %s", rollNumber => { expect(studentRegistrationSchema.safeParse({ ...validStudent, rollNumber }).success).toBe(false); });
  it("requires one of the eight configured departments", () => { expect(departments).toHaveLength(8); expect(studentRegistrationSchema.safeParse({ ...validStudent, department: "Unknown" }).success).toBe(false); });
});

describe("password rotation", () => {
  it("requires at least 12 characters and a different password", () => {
    expect(passwordChangeSchema.safeParse({ currentPassword: "temporary-password", newPassword: "a-new-private-password" }).success).toBe(true);
    expect(passwordChangeSchema.safeParse({ currentPassword: "temporary-password", newPassword: "short" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ currentPassword: "temporary-password", newPassword: "temporary-password" }).success).toBe(false);
  });
});

describe("live session payload validation", () => {
  const sessionId = "b5c8d20f-a923-4b68-94c4-547a2f522acc";

  it("accepts bounded chat messages and rejects empty, oversized, or extra fields", () => {
    expect(sessionMessageSchema.safeParse({ sessionId, body: "I need support" }).success).toBe(true);
    expect(sessionMessageSchema.safeParse({ sessionId, body: "   " }).success).toBe(false);
    expect(sessionMessageSchema.safeParse({ sessionId, body: "x".repeat(4001) }).success).toBe(false);
    expect(sessionMessageSchema.safeParse({ sessionId, body: "hello", admin: true }).success).toBe(false);
  });

  it("bounds WebRTC descriptions and ICE candidates", () => {
    expect(sessionSignalSchema.safeParse({ sessionId, signal: { sdp: { type: "offer", sdp: "v=0" } } }).success).toBe(true);
    expect(sessionSignalSchema.safeParse({ sessionId, signal: { candidate: { candidate: "x".repeat(2001) } } }).success).toBe(false);
  });
});

describe("emergency request context", () => {
  it("accepts only known moods and a boolean urgency flag", () => {
    expect(emergencyRequestSchema.strict().safeParse({ mode: "chat", mood: "Confused", urgent: true }).success).toBe(true);
    expect(emergencyRequestSchema.strict().safeParse({ mode: "chat", mood: "Custom mood", urgent: true }).success).toBe(false);
    expect(emergencyRequestSchema.strict().safeParse({ mode: "chat", mood: "Confused", urgent: "yes" }).success).toBe(false);
  });
});
