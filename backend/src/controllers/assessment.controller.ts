import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { Assessment } from "../models/Assessment.js";
import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";

const submissionSchema = z.object({ answers: z.array(z.boolean()).length(20) }).strict();
export const ASSESSMENT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const nextEligibleFrom = (completedAt: Date) => new Date(completedAt.getTime() + ASSESSMENT_INTERVAL_MS);

function bandFor(score: number, safetyFlag: boolean) {
  if (safetyFlag || score >= 15) return "urgent";
  if (score >= 11) return "high";
  if (score >= 6) return "moderate";
  return "low";
}

export async function assessmentStatus(req: Request, res: Response) {
  const history = await Assessment.find({ studentId: req.auth!.id })
    .select("score band safetyFlag completedAt monthKey")
    .sort({ completedAt: -1 })
    .limit(12);
  const latest = history[0] ?? null;
  const nextEligibleAt = latest ? nextEligibleFrom(latest.completedAt) : null;
  res.json({
    eligible: !nextEligibleAt || nextEligibleAt <= new Date(),
    nextEligibleAt,
    latest,
    history
  });
}

export async function submitAssessment(req: Request, res: Response) {
  const { answers } = submissionSchema.parse(req.body);
  const now = new Date();
  const latest = await Assessment.findOne({ studentId: req.auth!.id }).select("completedAt").sort({ completedAt: -1 }).lean();
  const existingNext = latest ? nextEligibleFrom(latest.completedAt) : null;
  if (existingNext && existingNext > now) {
    return res.status(409).json({ message: `Your next weekly assessment unlocks on ${existingNext.toLocaleDateString("en-IN")}` });
  }

  const nextEligibleAt = nextEligibleFrom(now);
  const locked = await User.findOneAndUpdate(
    {
      _id: req.auth!.id,
      role: "student",
      $or: [
        { assessmentNextEligibleAt: { $exists: false } },
        { assessmentNextEligibleAt: { $lte: now } }
      ]
    },
    { $set: { assessmentNextEligibleAt: nextEligibleAt } },
    { new: true }
  );
  if (!locked) return res.status(409).json({ message: "Your weekly assessment was already submitted" });

  const score = answers.filter(Boolean).length;
  const safetyFlag = answers[14] === true;
  const band = bandFor(score, safetyFlag);
  try {
    // Keep the legacy field unique for compatibility with existing Atlas indexes.
    const result = await Assessment.create({ studentId: req.auth!.id, monthKey: randomUUID(), answers, score, band, safetyFlag, completedAt: now });
    if (band === "urgent" || safetyFlag) {
      await AuditLog.create({ action: "assessment.support_alert", actorId: req.auth!.id, actorRole: "student", targetType: "Assessment", targetId: result.id, metadata: { score, band, safetyFlag, resolved: false } });
    }
    return res.status(201).json({ result, nextEligibleAt });
  } catch (error) {
    await User.updateOne({ _id: req.auth!.id, assessmentNextEligibleAt: nextEligibleAt }, { $unset: { assessmentNextEligibleAt: 1 } });
    throw error;
  }
}

export async function adminAssessments(_req: Request, res: Response) {
  const rows = await Assessment.find().select("studentId score band safetyFlag completedAt monthKey").populate("studentId", "fullName rollNumber department").sort({ completedAt: -1 }).limit(300);
  const distribution = await Assessment.aggregate([{ $group: { _id: "$band", count: { $sum: 1 } } }]);
  res.json({ assessments: rows, distribution: distribution.map(row => ({ band: row._id, count: row.count })) });
}
