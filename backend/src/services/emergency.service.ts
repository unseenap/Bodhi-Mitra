import { randomBytes, randomUUID } from "node:crypto";
import { env, hotlines } from "../config/env.js";
import { EmergencyRequest } from "../models/EmergencyRequest.js";
import { Session } from "../models/Session.js";
import { notifyPsychologists } from "./push.service.js";

export async function createEmergency(studentId: string, mode: string) {
  const active = await EmergencyRequest.findOne({ studentId, status: { $in: ["pending", "matched"] } }).select("+studentId");
  if (active) throw Object.assign(new Error("You already have an active request"), { status: 409 });
  const request = await EmergencyRequest.create({ studentId, mode, anonId: `Student ${randomBytes(3).toString("hex").toUpperCase()}`, timeoutAt: new Date(Date.now() + env.REQUEST_TIMEOUT_SECONDS * 1000) });
  void notifyPsychologists({ requestId: request.id, mode: request.mode });
  return request;
}
export async function acceptEmergency(requestId: string, psychologistId: string) {
  const request = await EmergencyRequest.findOneAndUpdate(
    { _id: requestId, status: "pending", timeoutAt: { $gt: new Date() } },
    { $set: { status: "matched", psychologistId, matchedAt: new Date() } }, { new: true, runValidators: true }
  ).select("+studentId");
  if (!request) return null;
  const sessionId = randomUUID();
  const session = await Session.create({ requestId: request.id, sessionId, mode: request.mode, studentId: request.studentId, psychologistId });
  return { request, session, anonToken: randomBytes(24).toString("base64url") };
}
export async function expireEmergency(requestId: string) {
  return EmergencyRequest.findOneAndUpdate({ _id: requestId, status: "pending" }, { $set: { status: "timeout" } }, { new: true }).select("+studentId");
}
export { hotlines };
