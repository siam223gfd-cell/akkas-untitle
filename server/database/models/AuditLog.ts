import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  module: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  details: string;
  recordId?: string;
  metadata?: any;
  ipAddress?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    actorName: { type: String, required: true },
    actorEmail: { type: String, required: true, index: true },
    actorRole: { type: String, default: 'admin' },
    details: { type: String, required: true },
    recordId: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
