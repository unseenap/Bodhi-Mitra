import jwt from "jsonwebtoken";
import type { Role, SafeUser } from "@bodhi/shared";
import { env } from "../config/env.js";
export const signToken = (id: string, role: Role) => jwt.sign({ sub: id, role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET) as { sub: string; role: Role };
export const safeUser = (user: any): SafeUser => ({ id: user.id, role: user.role, displayName: user.role === "student" ? user.fullName : user.fullName ?? user.email, ...(user.role === "student" ? { department: user.department, email: user.email, rollNumber: user.rollNumber, mobileNumber: user.mobileNumber } : {}), mustChangePassword: user.mustChangePassword });
export const makeOtp = () => String(Math.floor(100000 + Math.random() * 900000));
