import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { createOtpEmail } from "../templates/otpEmail.js";
const transporter = env.SMTP_HOST ? nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }) : null;
export async function sendOtp(email: string, otp: string) {
  if (!transporter) { if (env.NODE_ENV !== "production") console.info(`[development OTP] ${email}: ${otp}`); return; }
  const message = createOtpEmail({
    otp,
    expiresInMinutes: env.OTP_EXPIRES_MINUTES,
    campusHotlineLabel: env.CAMPUS_HOTLINE_LABEL,
    campusHotlineNumber: env.CAMPUS_HOTLINE_NUMBER,
  });
  await transporter.sendMail({ from: env.SMTP_FROM, to: email, ...message });
}
