import jwt from "jsonwebtoken";
import { randomInt } from "node:crypto";
import type { Role, SafeUser } from "@bodhi/shared";
import { env } from "../config/env.js";
const tokenOptions = { algorithms: ["HS256"] as jwt.Algorithm[], issuer: "bodhi-mitra-api", audience: "bodhi-mitra-app" };
export const signToken = (id: string, role: Role) => jwt.sign({ sub: id, role }, env.JWT_SECRET, { algorithm: "HS256", issuer: tokenOptions.issuer, audience: tokenOptions.audience, expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET, tokenOptions) as { sub: string; role: Role };
export const safeUser = (user: any): SafeUser => ({ id: user.id, role: user.role, displayName: user.role === "student" ? user.fullName : user.fullName ?? user.email, ...(user.role === "student" ? { department: user.department, email: user.email, rollNumber: user.rollNumber, mobileNumber: user.mobileNumber } : {}), mustChangePassword: user.mustChangePassword });
export const makeOtp = () => String(randomInt(100000, 1000000));
