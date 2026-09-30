import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().trim().min(1),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).max(20).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_CONNECT_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .default(10),
  DATABASE_SSL: z.enum(["disabled", "required"]).default("disabled"),
  DATABASE_SSL_CA_BASE64: z.string().trim().optional(),
  JWT_SECRET: z
    .string()
    .min(32)
    .default("development-only-secret-change-me-now"),
  JWT_EXPIRES_IN: z.string().default("12h"),
  OTP_EXPIRES_MINUTES: z.coerce.number().min(5).max(15).default(10),
  REQUEST_TIMEOUT_SECONDS: z.coerce.number().min(30).max(600).default(120),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("Bodhi-Mitra <support@example.edu>"),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:support@example.edu"),
  CAMPUS_HOTLINE_LABEL: z.string().default("GBU Counselling Centre"),
  CAMPUS_HOTLINE_NUMBER: z.string().default("+91 9650257255"),
  NATIONAL_HOTLINE_LABEL: z.string().default("Tele-MANAS"),
  NATIONAL_HOTLINE_NUMBER: z.string().default("14416"),
  ADMIN_EMAIL: z.string().email().default("admin@example.edu"),
  ADMIN_PASSWORD: z.string().min(10).default("replace-this-password"),
  TURN_URL: z.string().max(1000).optional(),
  TURN_SHARED_SECRET: z.string().min(16).optional(),
  TURN_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(3600),
});
export const env = schema.parse(process.env);
if (env.DATABASE_POOL_MIN > env.DATABASE_POOL_MAX)
  throw new Error("DATABASE_POOL_MIN cannot exceed DATABASE_POOL_MAX");
if (env.DATABASE_URL && !/^mysql2?:\/\//i.test(env.DATABASE_URL))
  throw new Error("DATABASE_URL must use the mysql:// protocol");
if (env.DATABASE_SSL_CA_BASE64 && env.DATABASE_SSL !== "required")
  throw new Error("DATABASE_SSL_CA_BASE64 requires DATABASE_SSL=required");
if (env.NODE_ENV === "production") {
  if (env.JWT_SECRET === "development-only-secret-change-me-now")
    throw new Error("JWT_SECRET must be replaced in production");
  if (env.ADMIN_PASSWORD === "replace-this-password")
    throw new Error("ADMIN_PASSWORD must be replaced in production");
  if (Boolean(env.TURN_URL) !== Boolean(env.TURN_SHARED_SECRET))
    throw new Error(
      "TURN_URL and TURN_SHARED_SECRET must be configured together",
    );
}
export const hotlines = [
  {
    label: env.CAMPUS_HOTLINE_LABEL,
    number: env.CAMPUS_HOTLINE_NUMBER,
    available: "Campus crisis support",
  },
  {
    label: env.NATIONAL_HOTLINE_LABEL,
    number: env.NATIONAL_HOTLINE_NUMBER,
    available: "24 hours",
  },
];
