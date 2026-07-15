import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { otpRequestSchema, otpVerifySchema, passwordLoginSchema, studentRegistrationSchema } from "@bodhi/shared";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { sendOtp } from "../services/email.service.js";
import { makeOtp, safeUser, signToken } from "../utils/auth.js";

async function assignOtp(user: any) { const otp = makeOtp(); user.otpHash = await bcrypt.hash(otp, 10); user.otpExpiresAt = new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60000); await user.save(); await sendOtp(user.email, otp); }
export async function registerStudent(req: Request, res: Response) {
  const data = studentRegistrationSchema.parse(req.body);
  if (await User.exists({ $or: [{ email: data.email }, { rollNumber: data.rollNumber }] })) return res.status(409).json({ message: "An account already exists for this email or roll number" });
  const user = await User.create({ ...data, role: "student", verified: false }); await assignOtp(user);
  res.status(201).json({ message: "We emailed your 6-digit code", identifier: user.email });
}
export async function requestOtp(req: Request, res: Response) {
  const { identifier } = otpRequestSchema.parse(req.body); const normalized = identifier.toLowerCase();
  const user = await User.findOne({ role: "student", $or: [{ email: normalized }, { rollNumber: identifier.toUpperCase() }], isActive: true });
  if (user) await assignOtp(user); res.json({ message: "If the account exists, a code has been emailed" });
}
export async function verifyOtp(req: Request, res: Response) {
  const { identifier, otp } = otpVerifySchema.parse(req.body); const user = await User.findOne({ role: "student", $or: [{ email: identifier.toLowerCase() }, { rollNumber: identifier.toUpperCase() }], isActive: true }).select("+otpHash +otpExpiresAt");
  if (!user?.otpHash || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now() || !(await bcrypt.compare(otp, user.otpHash))) return res.status(401).json({ message: "The code is invalid or expired" });
  user.verified = true; user.otpHash = undefined; user.otpExpiresAt = undefined; await user.save(); res.json({ token: signToken(user.id, "student"), user: safeUser(user) });
}
export async function passwordLogin(req: Request, res: Response) {
  const data = passwordLoginSchema.parse(req.body); const user = await User.findOne({ email: data.email, role: data.role, isActive: true, verified: true }).select("+passwordHash");
  if (!user?.passwordHash || !(await bcrypt.compare(data.password, user.passwordHash))) return res.status(401).json({ message: "Email or password is incorrect" });
  res.json({ token: signToken(user.id, data.role), user: safeUser(user) });
}
export async function me(req: Request, res: Response) { const user = await User.findById(req.auth!.id); if (!user) return res.status(404).json({ message: "Account not found" }); res.json({ user: safeUser(user) }); }
