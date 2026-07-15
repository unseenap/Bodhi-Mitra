import nodemailer from "nodemailer";
import { env } from "../config/env.js";
const transporter = env.SMTP_HOST ? nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }) : null;
export async function sendOtp(email: string, otp: string) {
  if (!transporter) { if (env.NODE_ENV !== "production") console.info(`[development OTP] ${email}: ${otp}`); return; }
  await transporter.sendMail({ from: env.SMTP_FROM, to: email, subject: "Your Bodhi-Mitra sign-in code", text: `Your Bodhi-Mitra code is ${otp}. It expires in ${env.OTP_EXPIRES_MINUTES} minutes. If you did not request it, ignore this email.` });
}
