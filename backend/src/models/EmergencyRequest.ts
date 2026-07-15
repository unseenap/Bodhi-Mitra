import { Schema, model } from "mongoose";
const schema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, select: false }, anonId: { type: String, required: true },
  mode: { type: String, enum: ["chat", "voice", "video"], required: true }, status: { type: String, enum: ["pending", "matched", "timeout", "cancelled", "ended"], default: "pending", index: true },
  psychologistId: { type: Schema.Types.ObjectId, ref: "User" }, matchedAt: Date, timeoutAt: { type: Date, required: true, index: true }
}, { timestamps: true });
export const EmergencyRequest = model("EmergencyRequest", schema);
