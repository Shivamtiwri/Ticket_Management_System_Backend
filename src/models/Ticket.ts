import mongoose, { Schema } from 'mongoose';
import { ITicket, IAttachment, TicketPriority, TicketStatus } from '../types';
import { generateTicketId } from '../utils/ticketId';

const AttachmentSchema = new Schema<IAttachment>({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  path: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const TicketSchema = new Schema<ITicket>(
  {
    ticketId: {
      type: String,
      unique: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      minlength: [5, 'Subject must be at least 5 characters'],
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    priority: {
      type: String,
      enum: Object.values(TicketPriority),
      required: [true, 'Priority is required'],
      default: TicketPriority.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.OPEN,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAgent: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    attachments: [AttachmentSchema],
    tags: [{ type: String, trim: true }],
    resolvedAt: Date,
    closedAt: Date,
  },
  { timestamps: true }
);

TicketSchema.pre('save', function (next) {
  if (this.isNew) {
    this.ticketId = generateTicketId();
  }
  next();
});

TicketSchema.index({ createdBy: 1 });
TicketSchema.index({ assignedAgent: 1 });
TicketSchema.index({ status: 1 });
TicketSchema.index({ priority: 1 });
TicketSchema.index({ category: 1 });
TicketSchema.index({ ticketId: 1 });
TicketSchema.index({ subject: 'text', description: 'text' });
TicketSchema.index({ createdAt: -1 });

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
