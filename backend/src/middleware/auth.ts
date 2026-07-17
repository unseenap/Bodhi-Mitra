import type { NextFunction, Request, Response } from "express";
import type { Role } from "@bodhi/shared";
import { verifyToken } from "../utils/auth.js";
import { User } from "../models/User.js";
export const requireAuth = (roles?: Role[]) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const value = req.headers.authorization;
    if (!value?.startsWith("Bearer ")) return res.status(401).json({ message: "Authentication required" });
    const claims = verifyToken(value.slice(7));
    const user = await User.findOne({ _id: claims.sub, role: claims.role, isActive: true, verified: true }).select("role").lean();
    if (!user) return res.status(401).json({ message: "Your account is unavailable or your session has expired" });
    req.auth = { id: claims.sub, role: user.role as Role };
    if (roles && !roles.includes(user.role as Role)) return res.status(403).json({ message: "You do not have access to this resource" });
    next();
  } catch { res.status(401).json({ message: "Your session is invalid or expired" }); }
};
