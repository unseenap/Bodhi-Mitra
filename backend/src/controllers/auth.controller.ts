import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { otpRequestSchema, otpVerifySchema, passwordChangeSchema, passwordLoginSchema, studentRegistrationSchema } from "@bodhi/shared";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { PendingStudentRegistration } from "../models/PendingStudentRegistration.js";
import { sendOtp } from "../services/email.service.js";
import { makeOtp, safeUser, signToken } from "../utils/auth.js";

const MAX_OTP_ATTEMPTS = 5;
const dummyPasswordHash = bcrypt.hash("Bodhi-Mitra-dummy-password", 12);

async function assignOtp(user: any) {
  const otp = makeOtp();
  user.otpHash = await bcrypt.hash(otp, 10);
  user.otpExpiresAt = new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60000);
  user.otpAttempts = 0;
  await user.save();
  await sendOtp(user.email, otp);
}
export async function registerStudent(req: Request, res: Response) {
  const data = studentRegistrationSchema.parse(req.body);
  const existing = await User.findOne({ role: "student", $or: [{ email: data.email }, { rollNumber: data.rollNumber }] });
  if (existing?.verified) return res.status(409).json({ message: "Unable to register with these details. Try signing in or contact support." });
  // Remove records created by the previous pre-verification flow so students can correct mistyped details.
  if (existing && !existing.verified) await User.deleteOne({ _id: existing._id, verified: false });
  await PendingStudentRegistration.deleteMany({ $or: [{ email: data.email }, { rollNumber: data.rollNumber }] });
  const otp = makeOtp();
  const otpExpiresAt = new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60000);
  await PendingStudentRegistration.create({ ...data, otpHash: await bcrypt.hash(otp, 10), otpExpiresAt, otpAttempts: 0, expiresAt: otpExpiresAt });
  await sendOtp(data.email, otp);
  res.status(201).json({ message: "We emailed your 6-digit code", identifier: data.email });
}
export async function requestOtp(req: Request, res: Response) {
  const { identifier } = otpRequestSchema.parse(req.body); const normalized = identifier.toLowerCase();
  const user = await User.findOne({ role: "student", verified: true, $or: [{ email: normalized }, { rollNumber: identifier.toUpperCase() }], isActive: true });
  if (user) await assignOtp(user); res.json({ message: "If the account exists, a code has been emailed" });
}
export async function verifyOtp(req: Request, res: Response) {
  const { identifier, otp } = otpVerifySchema.parse(req.body);
  const email = identifier.toLowerCase();
  const pending = await PendingStudentRegistration.findOne({ email }).select("+otpHash +otpExpiresAt +otpAttempts");
  if (pending) {
    if (pending.otpExpiresAt.getTime() < Date.now()) { await PendingStudentRegistration.deleteOne({ _id: pending._id }); return res.status(401).json({ message: "The code is invalid or expired" }); }
    if (pending.otpAttempts >= MAX_OTP_ATTEMPTS || !(await bcrypt.compare(otp, pending.otpHash))) {
      const attempts = pending.otpAttempts + 1;
      if (attempts >= MAX_OTP_ATTEMPTS) await PendingStudentRegistration.deleteOne({ _id: pending._id });
      else await PendingStudentRegistration.updateOne({ _id: pending._id }, { $set: { otpAttempts: attempts } });
      return res.status(401).json({ message: attempts >= MAX_OTP_ATTEMPTS ? "Too many incorrect attempts. Request a new code." : "The code is invalid or expired" });
    }
    if (await User.exists({ role: "student", $or: [{ email: pending.email }, { rollNumber: pending.rollNumber }] })) return res.status(409).json({ message: "Unable to complete registration. Try signing in or contact support." });
    try {
      const user = await User.create({ fullName: pending.fullName, rollNumber: pending.rollNumber, email: pending.email, mobileNumber: pending.mobileNumber, department: pending.department, role: "student", verified: true });
      await PendingStudentRegistration.deleteOne({ _id: pending._id });
      return res.json({ token: signToken(user.id, "student"), user: safeUser(user) });
    } catch (error: any) {
      if (error?.code === 11000) return res.status(409).json({ message: "Unable to complete registration. Try signing in or contact support." });
      throw error;
    }
  }
  const user = await User.findOne({ role: "student", verified: true, $or: [{ email }, { rollNumber: identifier.toUpperCase() }], isActive: true }).select("+otpHash +otpExpiresAt +otpAttempts");
  if (!user?.otpHash || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) return res.status(401).json({ message: "The code is invalid or expired" });
  if (user.otpAttempts >= MAX_OTP_ATTEMPTS || !(await bcrypt.compare(otp, user.otpHash))) {
    user.otpAttempts += 1;
    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) { user.otpHash = undefined; user.otpExpiresAt = undefined; }
    await user.save();
    return res.status(401).json({ message: user.otpAttempts >= MAX_OTP_ATTEMPTS ? "Too many incorrect attempts. Request a new code." : "The code is invalid or expired" });
  }
  const consumed = await User.findOneAndUpdate({ _id: user._id, otpHash: user.otpHash }, { $unset: { otpHash: 1, otpExpiresAt: 1 }, $set: { otpAttempts: 0 } }, { new: true });
  if (!consumed) return res.status(401).json({ message: "The code has already been used. Request a new code." });
  res.json({ token: signToken(consumed.id, "student"), user: safeUser(consumed) });
}
export async function passwordLogin(req: Request, res: Response) {
  const data = passwordLoginSchema.parse(req.body); const user = await User.findOne({ email: data.email, role: data.role, isActive: true, verified: true }).select("+passwordHash");
  const passwordMatches = await bcrypt.compare(data.password, user?.passwordHash ?? await dummyPasswordHash);
  if (!user?.passwordHash || !passwordMatches) return res.status(401).json({ message: "Email or password is incorrect" });
  res.json({ token: signToken(user.id, data.role), user: safeUser(user) });
}
export async function changePassword(req: Request, res: Response) {
  const data = passwordChangeSchema.parse(req.body);
  const user = await User.findById(req.auth!.id).select("+passwordHash");
  if (!user?.passwordHash || !(await bcrypt.compare(data.currentPassword, user.passwordHash))) return res.status(401).json({ message: "Current password is incorrect" });
  user.passwordHash = await bcrypt.hash(data.newPassword, 12);
  user.mustChangePassword = false;
  await user.save();
  res.json({ token: signToken(user.id, user.role), user: safeUser(user) });
}
export async function me(req: Request, res: Response) { const user = await User.findById(req.auth!.id); if (!user) return res.status(404).json({ message: "Account not found" }); res.json({ user: safeUser(user) }); }
