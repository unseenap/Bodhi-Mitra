import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { otpRequestSchema, otpVerifySchema, passwordLoginSchema, studentRegistrationSchema } from "@bodhi/shared";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { PendingStudentRegistration } from "../models/PendingStudentRegistration.js";
import { sendOtp } from "../services/email.service.js";
import { makeOtp, safeUser, signToken } from "../utils/auth.js";

async function assignOtp(user: any) { const otp = makeOtp(); user.otpHash = await bcrypt.hash(otp, 10); user.otpExpiresAt = new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60000); await user.save(); await sendOtp(user.email, otp); }
export async function registerStudent(req: Request, res: Response) {
  const data = studentRegistrationSchema.parse(req.body);
  const existing = await User.findOne({ role: "student", $or: [{ email: data.email }, { rollNumber: data.rollNumber }] });
  if (existing?.verified) return res.status(409).json({ message: "A verified account already exists for this email or roll number" });
  // Remove records created by the previous pre-verification flow so students can correct mistyped details.
  if (existing && !existing.verified) await User.deleteOne({ _id: existing._id, verified: false });
  await PendingStudentRegistration.deleteMany({ $or: [{ email: data.email }, { rollNumber: data.rollNumber }] });
  const otp = makeOtp();
  const otpExpiresAt = new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60000);
  await PendingStudentRegistration.create({ ...data, otpHash: await bcrypt.hash(otp, 10), otpExpiresAt, expiresAt: otpExpiresAt });
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
  const pending = await PendingStudentRegistration.findOne({ email }).select("+otpHash +otpExpiresAt");
  if (pending) {
    if (pending.otpExpiresAt.getTime() < Date.now() || !(await bcrypt.compare(otp, pending.otpHash))) return res.status(401).json({ message: "The code is invalid or expired" });
    if (await User.exists({ role: "student", $or: [{ email: pending.email }, { rollNumber: pending.rollNumber }] })) return res.status(409).json({ message: "A verified account already exists for this email or roll number" });
    try {
      const user = await User.create({ fullName: pending.fullName, rollNumber: pending.rollNumber, email: pending.email, mobileNumber: pending.mobileNumber, department: pending.department, role: "student", verified: true });
      await PendingStudentRegistration.deleteOne({ _id: pending._id });
      return res.json({ token: signToken(user.id, "student"), user: safeUser(user) });
    } catch (error: any) {
      if (error?.code === 11000) return res.status(409).json({ message: "A verified account already exists for this email or roll number" });
      throw error;
    }
  }
  const user = await User.findOne({ role: "student", verified: true, $or: [{ email }, { rollNumber: identifier.toUpperCase() }], isActive: true }).select("+otpHash +otpExpiresAt");
  if (!user?.otpHash || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now() || !(await bcrypt.compare(otp, user.otpHash))) return res.status(401).json({ message: "The code is invalid or expired" });
  user.otpHash = undefined; user.otpExpiresAt = undefined; await user.save(); res.json({ token: signToken(user.id, "student"), user: safeUser(user) });
}
export async function passwordLogin(req: Request, res: Response) {
  const data = passwordLoginSchema.parse(req.body); const user = await User.findOne({ email: data.email, role: data.role, isActive: true, verified: true }).select("+passwordHash");
  if (!user?.passwordHash || !(await bcrypt.compare(data.password, user.passwordHash))) return res.status(401).json({ message: "Email or password is incorrect" });
  res.json({ token: signToken(user.id, data.role), user: safeUser(user) });
}
export async function me(req: Request, res: Response) { const user = await User.findById(req.auth!.id); if (!user) return res.status(404).json({ message: "Account not found" }); res.json({ user: safeUser(user) }); }
