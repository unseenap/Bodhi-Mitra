import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) return res.status(400).json({ message: "Please check the submitted information", issues: error.flatten() });
  console.error(error); return res.status((error as any).status ?? 500).json({ message: (error as Error).message || "Unexpected server error" });
};
