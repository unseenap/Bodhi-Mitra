import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "./config/env.js";
import { destroyMysql, initializeMysql } from "./database/client.js";

const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
const db = await initializeMysql();
await db.insertInto("users").values({
    user_uuid: randomUUID(), role: "admin", full_name: "Bodhi-Mitra Administrator",
    email: env.ADMIN_EMAIL.toLowerCase(), password_hash: passwordHash,
    otp_hash: null, otp_expires_at: null, otp_attempts: 0,
    verified: true, is_active: true, must_change_password: true,
}).onDuplicateKeyUpdate({ password_hash: passwordHash, verified: true, is_active: true, must_change_password: true }).executeTakeFirst();
console.info(`Admin account ready: ${env.ADMIN_EMAIL}`);
await destroyMysql();
