import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"), PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"), MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/bodhi-mitra"),
  JWT_SECRET: z.string().min(32).default("development-only-secret-change-me-now"), JWT_EXPIRES_IN: z.string().default("12h"),
  OTP_EXPIRES_MINUTES: z.coerce.number().min(5).max(15).default(10), REQUEST_TIMEOUT_SECONDS: z.coerce.number().min(30).max(600).default(120),
  SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().default(587), SMTP_USER: z.string().optional(), SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("Bodhi-Mitra <support@example.edu>"), VAPID_PUBLIC_KEY: z.string().optional(), VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:support@example.edu"), CAMPUS_HOTLINE_LABEL: z.string().default("GBU Counselling Centre"),
  CAMPUS_HOTLINE_NUMBER: z.string().default("+91 1212121212"), NATIONAL_HOTLINE_LABEL: z.string().default("Tele-MANAS"),
  NATIONAL_HOTLINE_NUMBER: z.string().default("14416"), ADMIN_EMAIL: z.string().email().default("admin@example.edu"), ADMIN_PASSWORD: z.string().min(10).default("replace-this-password")
});
export const env = schema.parse(process.env);
export const hotlines = [
  { label: env.CAMPUS_HOTLINE_LABEL, number: env.CAMPUS_HOTLINE_NUMBER, available: "Campus crisis support" },
  { label: env.NATIONAL_HOTLINE_LABEL, number: env.NATIONAL_HOTLINE_NUMBER, available: "24 hours" }
];
