import { Schema, model } from "mongoose";

const notificationSchema = new Schema({
  recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  recipientRole: { type: String, enum: ["student", "psychologist", "admin"], required: true, index: true },
  type: { type: String, required: true, trim: true, maxlength: 120, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 280 },
  priority: { type: String, enum: ["critical", "high", "normal", "low"], default: "normal", index: true },
  actionUrl: { type: String, trim: true, maxlength: 300 },
  entityType: { type: String, trim: true, maxlength: 80 },
  entityId: { type: String, trim: true, maxlength: 120 },
  channels: [{ type: String, enum: ["in_app", "socket", "push", "email"] }],
  deduplicationKey: { type: String, required: true, trim: true, maxlength: 220 },
  readAt: Date,
  acknowledgedAt: Date,
  scheduledAt: Date,
  deliveredAt: Date,
  expiresAt: Date
}, { timestamps: true });

notificationSchema.index(
  { recipientId: 1, deduplicationKey: 1 },
  { unique: true, name: "notification_recipient_deduplication" }
);
notificationSchema.index({ recipientId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

export const Notification = model("Notification", notificationSchema);
