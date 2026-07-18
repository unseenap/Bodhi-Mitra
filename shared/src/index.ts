import { z } from "zod";

export const roles = ["student", "psychologist", "admin"] as const;
export const sessionModes = ["chat", "voice", "video"] as const;
export const requestStatuses = ["pending", "matched", "timeout", "cancelled", "ended"] as const;
export const specializations = ["Anxiety", "Depression", "Trauma", "Addiction", "Relationships", "Academic Stress", "Grief"] as const;
export const expertCategories = ["senior", "consultant", "trainee"] as const;
export const departments = [
  "School of Management (SoM)",
  "School of Biotechnology (SoBT)",
  "School of Information & Communication Technology (SoICT)",
  "School of Engineering (SoE)",
  "School of Humanities & Social Sciences (SoHSS)",
  "School of Vocational Studies & Applied Sciences (SoVSAS)",
  "School of Law, Justice & Governance (SoLJG)",
  "School of Buddhist Studies & Civilization (SoBSC)"
] as const;

export type Role = (typeof roles)[number];
export type SessionMode = (typeof sessionModes)[number];
export type RequestStatus = (typeof requestStatuses)[number];

export const emailSchema = z.string().trim().toLowerCase().email();
export const studentRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  rollNumber: z.string().trim().toUpperCase().regex(/^\d{3}[A-Z]{3}\d{3}$/, "Use the 9-character GBU format, for example 235UCS006"),
  email: emailSchema,
  mobileNumber: z.string().regex(/^\+91[6-9]\d{9}$/, "Use +91 followed by a valid 10-digit number"),
  department: z.enum(departments),
  password: z.string().min(12, "Use at least 12 characters").max(128)
});
export const otpRequestSchema = z.object({ identifier: z.string().trim().min(5).max(120) });
export const otpVerifySchema = z.object({ identifier: z.string().trim().min(5), otp: z.string().regex(/^\d{6}$/) });
export const passwordLoginSchema = z.object({
  email: emailSchema.optional(), identifier: z.string().trim().min(5).max(120).optional(),
  password: z.string().min(8).max(128), role: z.enum(roles)
}).superRefine((data, context) => {
  if (data.role === "student" && !data.identifier) context.addIssue({ code: "custom", path: ["identifier"], message: "Email or roll number is required" });
  if (data.role !== "student" && !data.email) context.addIssue({ code: "custom", path: ["email"], message: "Email is required" });
});
export const passwordResetSchema = z.object({ identifier: z.string().trim().min(5).max(120), otp: z.string().regex(/^\d{6}$/), newPassword: z.string().min(12).max(128) });
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(8).max(128), newPassword: z.string().min(12).max(128) }).refine(data => data.currentPassword !== data.newPassword, { path: ["newPassword"], message: "Choose a password you have not used for this sign-in" });
export const emergencyMoods = ["Anxious", "Depressed", "Overwhelmed", "Angry", "Confused", "Just need to talk"] as const;
export const emergencyRequestSchema = z.object({
  mode: z.enum(sessionModes),
  mood: z.enum(emergencyMoods).optional(),
  urgent: z.boolean().optional().default(false)
});
export const emergencyIdSchema = z.object({ requestId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
export const sessionIdSchema = z.object({ sessionId: z.string().uuid() }).strict();
export const sessionMessageSchema = z.object({
  sessionId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000)
}).strict();
const sessionDescriptionSchema = z.object({
  type: z.enum(["offer", "answer", "pranswer", "rollback"]),
  sdp: z.string().max(50_000).optional()
}).strict();
const iceCandidateSchema = z.object({
  candidate: z.string().max(2_000),
  sdpMid: z.string().max(100).nullable().optional(),
  sdpMLineIndex: z.number().int().min(0).max(100).nullable().optional(),
  usernameFragment: z.string().max(256).nullable().optional()
}).strict();
export const sessionSignalSchema = z.object({
  sessionId: z.string().uuid(),
  signal: z.union([
    z.object({ sdp: sessionDescriptionSchema }).strict(),
    z.object({ candidate: iceCandidateSchema }).strict()
  ])
}).strict();
export const psychologistSchema = z.object({
  name: z.string().trim().min(2).max(100), email: emailSchema,
  password: z.string().min(10).max(128).optional(),
  professionalTitle: z.string().trim().min(3).max(100).default("Clinical Psychologist"),
  specializations: z.array(z.string().trim().min(2).max(80)).min(1).max(20),
  expertCategory: z.enum(expertCategories).default("consultant"), portraitUrl: z.string().trim().max(300).optional(),
  verified: z.boolean().default(false), isActive: z.boolean().default(true)
});

export interface SafeUser { id: string; role: Role; displayName: string; department?: string; email?: string; rollNumber?: string; mobileNumber?: string; mustChangePassword?: boolean }
export interface PendingEmergency { requestId: string; anonId: string; mode: SessionMode; waitStartedAt: string; mood?: string; urgent?: boolean }
export interface Hotline { label: string; number: string; available: string }
export interface SessionMatch { sessionId: string; mode: SessionMode; peerLabel: string; ended?: boolean; mood?: string; urgent?: boolean }

export const SOCKET_EVENTS = {
  EMERGENCY_REQUEST: "emergency:request", EMERGENCY_NEW: "emergency:new", EMERGENCY_QUEUED: "emergency:queued",
  EMERGENCY_ACCEPT: "emergency:accept", EMERGENCY_TAKEN: "emergency:taken", EMERGENCY_CANCEL: "emergency:cancel",
  EMERGENCY_TIMEOUT: "emergency:timeout", SESSION_MATCHED: "session:matched", SESSION_JOIN: "session:join",
  SESSION_READY: "session:ready", SESSION_MESSAGE: "session:message", SESSION_SIGNAL: "session:signal",
  SESSION_END: "session:end", ERROR: "app:error"
} as const;
