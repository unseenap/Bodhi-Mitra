import { Schema, model } from "mongoose";
const schema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, select: false }, anonId: { type: String, required: true },
  mode: { type: String, enum: ["chat", "voice", "video"], required: true }, status: { type: String, enum: ["pending", "matched", "timeout", "cancelled", "ended"], default: "pending", index: true },
  mood: { type: String, enum: ["Anxious", "Depressed", "Overwhelmed", "Angry", "Confused", "Just need to talk"] },
  urgent: { type: Boolean, default: false, index: true },
  psychologistId: { type: Schema.Types.ObjectId, ref: "User" }, matchedAt: Date, timeoutAt: { type: Date, required: true, index: true }
}, { timestamps: true });
// A student may have only one live request, including when two browser tabs
// submit at nearly the same time. Completed requests remain unrestricted.
schema.index(
  { studentId: 1 },
  { name: "one_live_emergency_per_student", unique: true, partialFilterExpression: { status: { $in: ["pending", "matched"] } } }
);
export const EmergencyRequest = model("EmergencyRequest", schema);
