import { Schema, model } from "mongoose";
const schema = new Schema({ action: { type: String, required: true }, actorId: Schema.Types.ObjectId, actorRole: String, targetType: String, targetId: String, metadata: Schema.Types.Mixed }, { timestamps: true });
export const AuditLog = model("AuditLog", schema);
