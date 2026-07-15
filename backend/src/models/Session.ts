import { Schema, model } from "mongoose";
const schema = new Schema({
  requestId: { type: Schema.Types.ObjectId, ref: "EmergencyRequest", required: true, unique: true }, sessionId: { type: String, required: true, unique: true },
  mode: { type: String, enum: ["chat", "voice", "video"], required: true }, studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, select: false },
  psychologistId: { type: Schema.Types.ObjectId, ref: "User", required: true }, startedAt: { type: Date, default: Date.now }, endedAt: Date,
  rating: { type: Number, min: 1, max: 5 }, feedbackText: { type: String, maxlength: 1000, select: false }, feedbackSubmittedAt: Date
}, { timestamps: true });
export const Session = model("Session", schema);
