import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { User } from "./models/User.js";
await mongoose.connect(env.MONGODB_URI);
const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
await User.findOneAndUpdate({ email: env.ADMIN_EMAIL }, { role: "admin", email: env.ADMIN_EMAIL, passwordHash, verified: true, isActive: true }, { upsert: true });
console.info(`Admin account ready: ${env.ADMIN_EMAIL}`); await mongoose.disconnect();
