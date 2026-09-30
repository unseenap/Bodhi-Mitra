import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { io, type Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@bodhi/shared";
import { destroyMysql, initializeMysql } from "./client.js";
import { signToken } from "../utils/auth.js";

const url = process.env.SMOKE_API_URL ?? "http://127.0.0.1:4010";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url) && process.env.SMOKE_REMOTE_CONFIRM !== "bodhi-mitra")
  throw new Error("Remote smoke tests require SMOKE_REMOTE_CONFIRM=bodhi-mitra");
const db = await initializeMysql();
const studentUuid = randomUUID(); const psychologistUuid = randomUUID();
const suffix = studentUuid.slice(0, 8); let studentId = ""; let psychologistId = ""; let requestUuid = ""; let sessionUuid = ""; let assessmentUuid = "";
const sockets: Socket[] = [];
const waitEvent = <T>(socket: Socket, event: string, timeout = 10_000) => new Promise<T>((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout); socket.once(event, value => { clearTimeout(timer); resolve(value); }); });
const ack = (socket: Socket, event: string, payload: unknown) => new Promise<any>((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Timed out acknowledging ${event}`)), 10_000); socket.emit(event, payload, (value: any) => { clearTimeout(timer); value?.ok ? resolve(value) : reject(new Error(value?.message ?? `${event} failed`)); }); });
try {
  const department = await db.selectFrom("departments").select("id").where("code", "=", "SoICT").executeTakeFirstOrThrow(); const passwordHash = await bcrypt.hash(randomUUID(), 10);
  const studentInsert = await db.insertInto("users").values({ user_uuid: studentUuid, role: "student", full_name: "Runtime Smoke Student", email: `runtime-student-${suffix}@example.edu`, password_hash: passwordHash, otp_hash: null, otp_expires_at: null, otp_attempts: 0, verified: true, is_active: true, must_change_password: false }).executeTakeFirstOrThrow(); studentId = String(studentInsert.insertId);
  await db.insertInto("student_profiles").values({ user_id: studentId, roll_number: `999UCS${suffix.replace(/\D/g, "").padEnd(3, "7").slice(0,3)}`, mobile_number: `+91999${String(Date.now()).slice(-7)}`, department_id: department.id, assessment_next_eligible_at: null }).executeTakeFirstOrThrow();
  const psychologistInsert = await db.insertInto("users").values({ user_uuid: psychologistUuid, role: "psychologist", full_name: "Runtime Smoke Psychologist", email: `runtime-psych-${suffix}@example.edu`, password_hash: passwordHash, otp_hash: null, otp_expires_at: null, otp_attempts: 0, verified: true, is_active: true, must_change_password: false }).executeTakeFirstOrThrow(); psychologistId = String(psychologistInsert.insertId);
  await db.insertInto("psychologist_profiles").values({ user_id: psychologistId, professional_title: "Runtime Test Psychologist", expert_category: "consultant", portrait_url: null, is_online: false, is_available: true }).executeTakeFirstOrThrow();
  const studentToken = signToken(studentUuid, "student"); const psychologistToken = signToken(psychologistUuid, "psychologist");
  const api = async (path: string, token: string, init: RequestInit = {}) => { const response = await fetch(`${url}/api${path}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers ?? {}) } }); if (!response.ok) throw new Error(`${path} returned ${response.status}: ${await response.text()}`); return response.json(); };
  await Promise.all([api("/auth/me", studentToken), api("/student/history", studentToken), api("/student/assessment", studentToken), api("/psychologist/summary", psychologistToken), api("/psychologist/profile", psychologistToken), api("/psychologist/queue", psychologistToken)]);
  const student = io(url, { transports: ["websocket"], auth: { token: studentToken } }); const psychologist = io(url, { transports: ["websocket"], auth: { token: psychologistToken } }); sockets.push(student, psychologist);
  await Promise.all([waitEvent(student, "connect"), waitEvent(psychologist, "connect")]);
  const queued = waitEvent<any>(student, SOCKET_EVENTS.EMERGENCY_QUEUED); const incoming = waitEvent<any>(psychologist, SOCKET_EVENTS.EMERGENCY_NEW);
  await ack(student, SOCKET_EVENTS.EMERGENCY_REQUEST, { mode: "voice", mood: "Just need to talk", urgent: false }); requestUuid = (await queued).requestId; await incoming;
  const studentMatch = waitEvent<any>(student, SOCKET_EVENTS.SESSION_MATCHED); const psychologistMatch = waitEvent<any>(psychologist, SOCKET_EVENTS.SESSION_MATCHED);
  await ack(psychologist, SOCKET_EVENTS.EMERGENCY_ACCEPT, { requestId: requestUuid }); sessionUuid = (await studentMatch).sessionId; await psychologistMatch;
  await Promise.all([api(`/sessions/${sessionUuid}`, studentToken), api(`/sessions/${sessionUuid}/ice-config`, psychologistToken)]);
  await Promise.all([ack(student, SOCKET_EVENTS.SESSION_JOIN, { sessionId: sessionUuid }), ack(psychologist, SOCKET_EVENTS.SESSION_JOIN, { sessionId: sessionUuid })]);
  const message = waitEvent<any>(psychologist, SOCKET_EVENTS.SESSION_MESSAGE); await ack(student, SOCKET_EVENTS.SESSION_MESSAGE, { sessionId: sessionUuid, body: "Runtime smoke message" }); if ((await message).body !== "Runtime smoke message") throw new Error("Chat relay mismatch");
  const signal = waitEvent<any>(psychologist, SOCKET_EVENTS.SESSION_SIGNAL); await ack(student, SOCKET_EVENTS.SESSION_SIGNAL, { sessionId: sessionUuid, signal: { candidate: { candidate: "candidate:runtime-smoke", sdpMid: "0", sdpMLineIndex: 0 } } }); if (!(await signal).signal?.candidate) throw new Error("WebRTC signal relay mismatch");
  await ack(student, SOCKET_EVENTS.SESSION_END, { sessionId: sessionUuid });
  await api(`/sessions/${sessionUuid}/rating`, studentToken, { method: "POST", body: JSON.stringify({ rating: 5, feedback: "Runtime smoke feedback" }) });
  const assessment = await api("/student/assessment", studentToken, { method: "POST", body: JSON.stringify({ answers: Array(20).fill(false) }) }); assessmentUuid = assessment.result.id;
  const persisted = await db.selectFrom("sessions as s").innerJoin("emergency_requests as e", "e.id", "s.request_id").select(["s.ended_at", "e.status"]).where("s.session_uuid", "=", sessionUuid).executeTakeFirstOrThrow();
  if (!persisted.ended_at || persisted.status !== "ended") throw new Error("Session end was not persisted");
  console.info(JSON.stringify({ ok: true, datastore: "mysql", http: { auth: true, student: true, psychologist: true, sessions: true, feedback: true, assessment: true }, socket: { emergency: true, matching: true, chatRelay: true, signalRelay: true, sessionEnd: true } }));
} finally {
  sockets.forEach(socket => socket.disconnect());
  const entityIds = [requestUuid, sessionUuid, assessmentUuid].filter(Boolean);
  if (entityIds.length || studentId || psychologistId) { const fixtureNotifications = db.selectFrom("notifications").select("id").where(eb => eb.or([...(entityIds.length ? [eb("entity_id", "in", entityIds)] : []), ...(studentId && psychologistId ? [eb("recipient_id", "in", [studentId, psychologistId])] : [])])); await db.deleteFrom("notification_delivery_attempts").where("notification_id", "in", fixtureNotifications).execute(); await db.deleteFrom("notifications").where(eb => eb.or([...(entityIds.length ? [eb("entity_id", "in", entityIds)] : []), ...(studentId && psychologistId ? [eb("recipient_id", "in", [studentId, psychologistId])] : [])])).execute(); }
  if (assessmentUuid) await db.deleteFrom("assessments").where("assessment_uuid", "=", assessmentUuid).execute();
  if (entityIds.length || studentId || psychologistId) await db.deleteFrom("audit_logs").where(eb => eb.or([...(entityIds.length ? [eb("target_id", "in", entityIds)] : []), ...(studentId && psychologistId ? [eb("actor_id", "in", [studentId, psychologistId])] : [])])).execute();
  if (sessionUuid) await db.deleteFrom("sessions").where("session_uuid", "=", sessionUuid).execute();
  if (requestUuid) await db.deleteFrom("emergency_requests").where("request_uuid", "=", requestUuid).execute();
  for (const internalId of [studentId, psychologistId].filter(Boolean)) { await db.deleteFrom("psychologist_specializations").where("psychologist_id", "=", internalId).execute(); await db.deleteFrom("psychologist_profiles").where("user_id", "=", internalId).execute(); await db.deleteFrom("student_profiles").where("user_id", "=", internalId).execute(); await db.deleteFrom("push_subscriptions").where("user_id", "=", internalId).execute(); await db.deleteFrom("notification_preferences").where("user_id", "=", internalId).execute(); await db.deleteFrom("users").where("id", "=", internalId).execute(); }
  await destroyMysql();
}
