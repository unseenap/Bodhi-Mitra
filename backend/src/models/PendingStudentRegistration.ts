import { Schema, model } from "mongoose";

const pendingStudentRegistrationSchema = new Schema({
  fullName: { type: String, required: true, trim: true },
  rollNumber: { type: String, required: true, trim: true, uppercase: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true, index: true },
  mobileNumber: { type: String, required: true },
  department: { type: String, required: true },
  otpHash: { type: String, required: true, select: false },
  otpExpiresAt: { type: Date, required: true, select: false },
  otpAttempts: { type: Number, default: 0, min: 0, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

export const PendingStudentRegistration = model("PendingStudentRegistration", pendingStudentRegistrationSchema);
