import type { NextFunction, Request, Response } from "express";
import type { Role } from "@bodhi/shared";
import { verifyToken } from "../utils/auth.js";
export const requireAuth = (roles?: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const value = req.headers.authorization;
    if (!value?.startsWith("Bearer ")) return res.status(401).json({ message: "Authentication required" });
    const claims = verifyToken(value.slice(7)); req.auth = { id: claims.sub, role: claims.role };
    if (roles && !roles.includes(claims.role)) return res.status(403).json({ message: "You do not have access to this resource" });
    next();
  } catch { res.status(401).json({ message: "Your session is invalid or expired" }); }
};
