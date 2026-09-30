import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { psychologistSchema } from "@bodhi/shared";
import { MysqlAuditRepository, MysqlPsychologistRepository } from "../repositories/mysql/index.js";

const psychologists = new MysqlPsychologistRepository();
const audits = new MysqlAuditRepository();

export async function mysqlExperts(_req: Request, res: Response) {
  res.json({ experts: await psychologists.list({ publicOnly: true, limit: 200 }) });
}

export async function mysqlListPsychologists(_req: Request, res: Response) {
  res.json({ psychologists: await psychologists.list({ publicOnly: false, limit: 200 }) });
}

export async function mysqlCreatePsychologist(req: Request, res: Response) {
  const data = psychologistSchema.parse(req.body);
  if (!data.password) return res.status(400).json({ message: "An initial password is required" });
  const psychologist = await psychologists.create({
    userUuid: randomUUID(), name: data.name, email: data.email,
    passwordHash: await bcrypt.hash(data.password, 12),
    professionalTitle: data.professionalTitle, category: data.expertCategory,
    specializations: data.specializations, portraitUrl: data.portraitUrl,
    verified: data.verified, isActive: data.isActive,
  });
  await audits.create({
    auditUuid: randomUUID(), action: "psychologist.created", actorUuid: req.auth!.id,
    actorRole: "admin", targetType: "User", targetId: psychologist.id,
  });
  res.status(201).json({ psychologist });
}

export async function mysqlUpdatePsychologist(req: Request, res: Response) {
  const data = psychologistSchema.partial().parse(req.body);
  const psychologistId = String(req.params.id);
  const before = await psychologists.findByUuid(psychologistId);
  if (!before) return res.status(404).json({ message: "Psychologist not found" });
  const psychologist = await psychologists.update(psychologistId, {
    ...(data.name !== undefined && { name: data.name }), ...(data.email !== undefined && { email: data.email }),
    ...(data.password && { passwordHash: await bcrypt.hash(data.password, 12) }),
    ...(data.professionalTitle !== undefined && { professionalTitle: data.professionalTitle }),
    ...(data.expertCategory !== undefined && { category: data.expertCategory }),
    ...(data.specializations !== undefined && { specializations: data.specializations }),
    ...(data.portraitUrl !== undefined && { portraitUrl: data.portraitUrl }),
    ...(data.verified !== undefined && { verified: data.verified }), ...(data.isActive !== undefined && { isActive: data.isActive }),
  });
  await audits.create({ auditUuid: randomUUID(), action: "psychologist.updated", actorUuid: req.auth!.id, actorRole: "admin", targetType: "User", targetId: psychologistId });
  res.json({ psychologist });
}
