import mongoose, { Schema } from 'mongoose';
import { IActivityLog, ActivityAction } from '../types';

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    ticket: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: Object.values(ActivityAction),
      required: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ActivityLogSchema.index({ ticket: 1, createdAt: -1 });
ActivityLogSchema.index({ actor: 1 });
ActivityLogSchema.index({ action: 1 });
ActivityLogSchema.index({ createdAt: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
