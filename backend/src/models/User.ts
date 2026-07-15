import { Schema, model } from "mongoose";

const userSchema = new Schema({
  role: { type: String, enum: ["student", "psychologist", "admin"], required: true, index: true },
  fullName: { type: String, trim: true }, rollNumber: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true }, mobileNumber: String, department: String,
  passwordHash: { type: String, select: false }, otpHash: { type: String, select: false }, otpExpiresAt: { type: Date, select: false },
  verified: { type: Boolean, default: false }, isActive: { type: Boolean, default: true }, mustChangePassword: { type: Boolean, default: false },
  professionalTitle: { type: String, trim: true }, specializations: [{ type: String, trim: true }],
  expertCategory: { type: String, enum: ["senior", "consultant", "trainee"], default: "consultant", index: true }, portraitUrl: { type: String, trim: true },
  isOnline: { type: Boolean, default: false }, isAvailable: { type: Boolean, default: true },
  pushSubscriptions: { type: [Schema.Types.Mixed], default: [], select: false }
}, { timestamps: true });
export const User = model("User", userSchema);
