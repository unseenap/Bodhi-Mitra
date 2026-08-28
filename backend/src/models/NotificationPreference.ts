import { Schema, model } from "mongoose";

const notificationPreferenceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  inApp: { type: Boolean, default: true },
  push: { type: Boolean, default: true },
  email: { type: Boolean, default: true },
  assessmentReminders: { type: Boolean, default: true },
  wellbeingReminders: { type: Boolean, default: false },
  maintenanceNotices: { type: Boolean, default: true },
  quietHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: "22:00" },
    end: { type: String, default: "07:00" },
    timezone: { type: String, default: "Asia/Kolkata", maxlength: 80 }
  }
}, { timestamps: true });

export const NotificationPreference = model("NotificationPreference", notificationPreferenceSchema);
