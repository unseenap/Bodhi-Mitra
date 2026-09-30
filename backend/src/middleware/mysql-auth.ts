import type { NextFunction, Request, Response } from "express";
import type { Role } from "@bodhi/shared";
import { MysqlUserRepository } from "../repositories/mysql/index.js";
import { verifyToken } from "../utils/auth.js";

const users = new MysqlUserRepository();

export const requireMysqlAuth = (roles?: Role[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const value = req.headers.authorization;
      if (!value?.startsWith("Bearer "))
        return res.status(401).json({ message: "Authentication required" });
      const claims = verifyToken(value.slice(7));
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.sub))
        return res.status(401).json({ message: "Your session was issued before the database migration. Please sign in again." });
      const user = await users.findByUuid(claims.sub);
      if (!user?.verified || !user.isActive || user.role !== claims.role)
        return res.status(401).json({ message: "Your account is unavailable or your session has expired" });
      req.auth = { id: user.id, role: user.role };
      if (roles && !roles.includes(user.role))
        return res.status(403).json({ message: "You do not have access to this resource" });
      next();
    } catch {
      res.status(401).json({ message: "Your session is invalid or expired" });
    }
  };
