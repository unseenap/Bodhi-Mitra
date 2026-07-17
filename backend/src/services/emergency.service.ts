import { randomBytes, randomUUID } from "node:crypto";
import { env, hotlines } from "../config/env.js";
import { EmergencyRequest } from "../models/EmergencyRequest.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { notifyPsychologists } from "./push.service.js";

export async function createEmergency(studentId: string, mode: string, context?: { mood?: string; urgent?: boolean }) {
  const active = await EmergencyRequest.findOne({ studentId, status: { $in: ["pending", "matched"] } }).select("+studentId");
  if (active) throw Object.assign(new Error("You already have an active request"), { status: 409 });
  let request;
  try {
    request = await EmergencyRequest.create({ studentId, mode, mood: context?.mood, urgent: context?.urgent ?? false, anonId: `Student ${randomBytes(3).toString("hex").toUpperCase()}`, timeoutAt: new Date(Date.now() + env.REQUEST_TIMEOUT_SECONDS * 1000) });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw Object.assign(new Error("You already have an active request"), { status: 409 });
    }
    throw error;
  }
  void notifyPsychologists({ requestId: request.id, mode: request.mode });
  return request;
}
export async function acceptEmergency(requestId: string, psychologistId: string) {
  const psychologist = await User.exists({
    _id: psychologistId, role: "psychologist", verified: true, isActive: true,
    isAvailable: true
  });
  if (!psychologist) throw Object.assign(new Error("Set yourself as available before accepting requests"), { status: 403 });
  const request = await EmergencyRequest.findOneAndUpdate(
    { _id: requestId, status: "pending", timeoutAt: { $gt: new Date() } },
    { $set: { status: "matched", psychologistId, matchedAt: new Date() } }, { new: true, runValidators: true }
  ).select("+studentId");
  if (!request) return null;
  const sessionId = randomUUID();
  try {
    const session = await Session.create({ requestId: request.id, sessionId, mode: request.mode, studentId: request.studentId, psychologistId });
    return { request, session };
  } catch (error) {
    // Do not strand the student in a matched state if session creation fails.
    await EmergencyRequest.updateOne(
      { _id: request.id, status: "matched", psychologistId },
      { $set: { status: "pending" }, $unset: { psychologistId: 1, matchedAt: 1 } }
    );
    throw error;
  }
}
export async function expireEmergency(requestId: string) {
  return EmergencyRequest.findOneAndUpdate({ _id: requestId, status: "pending" }, { $set: { status: "timeout" } }, { new: true }).select("+studentId");
}
export { hotlines };
