import mongoose, { Schema } from 'mongoose';
import { IComment, IAttachment } from '../types';

const AttachmentSchema = new Schema<IAttachment>({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  path: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const CommentSchema = new Schema<IComment>(
  {
    ticket: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [5000, 'Comment cannot exceed 5000 characters'],
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
    attachments: [AttachmentSchema],
  },
  { timestamps: true }
);

CommentSchema.index({ ticket: 1, createdAt: 1 });
CommentSchema.index({ author: 1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);
