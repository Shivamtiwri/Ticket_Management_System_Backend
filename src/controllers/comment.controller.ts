
import { Response } from 'express';
import { Comment } from '../models/Comment';
import { Ticket } from '../models/Ticket';
import { ActivityLog } from '../models/ActivityLog';
import { AuthRequest, UserRole, ActivityAction } from '../types';
import { sendSuccess, sendCreated, sendError } from '../utils/apiResponse';
import { ticketIdFilter } from '../utils/queryUtils';
import { emitCommentCreated, emitCommentDeleted } from '../socket';

export const getComments = async (req: AuthRequest, res: Response): Promise<void> => {
  const ticket = await Ticket.findOne(ticketIdFilter(req.params.ticketId));
  if (!ticket) {
    sendError(res, 'Ticket not found', 404);
    return;
  }

  if (req.user!.role === UserRole.CUSTOMER && ticket.createdBy.toString() !== req.user!.id) {
    sendError(res, 'Access denied', 403);
    return;
  }

  const isCustomer = req.user!.role === UserRole.CUSTOMER;
  const filter: Record<string, unknown> = { ticket: ticket._id };
  if (isCustomer) filter.isInternal = false;

  const comments = await Comment.find(filter)
    .populate('author', 'name email role')
    .sort({ createdAt: 1 });

  sendSuccess(res, comments);
};

export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const ticket = await Ticket.findOne(ticketIdFilter(req.params.ticketId));
  if (!ticket) {
    sendError(res, 'Ticket not found', 404);
    return;
  }


  if (req.user!.role === UserRole.CUSTOMER && ticket.createdBy.toString() !== req.user!.id) {
    sendError(res, 'Access denied', 403);
    return;
  }

  const files = (req.files as Express.Multer.File[]) || [];
  const attachments = files.map((file) => ({
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    uploadedBy: req.user!.id,
    uploadedAt: new Date(),
  }));

  const isInternal =
    req.user!.role !== UserRole.CUSTOMER &&
    (req.body.isInternal === true || req.body.isInternal === 'true');

  const comment = await Comment.create({
    ticket: ticket._id,
    author: req.user!.id,
    content: req.body.content,
    isInternal,
    attachments,
  });

  await comment.populate('author', 'name email role');

  await ActivityLog.create({
    ticket: ticket._id,
    actor: req.user!.id,
    action: ActivityAction.COMMENT_ADDED,
    description: `Comment added by ${req.user!.name}`,
    metadata: { commentId: comment._id, isInternal },
  });

  emitCommentCreated(comment);

  sendCreated(res, comment, 'Comment added successfully');
};

export const updateComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const ticket = await Ticket.findOne(ticketIdFilter(req.params.ticketId));
  if (!ticket) {
    sendError(res, 'Ticket not found', 404);
    return;
  }

  const comment = await Comment.findOne({
    _id: req.params.commentId,
    ticket: ticket._id,
  });
  if (!comment) {
    sendError(res, 'Comment not found', 404);
    return;
  }

  if (comment.author.toString() !== req.user!.id && req.user!.role !== UserRole.ADMIN) {
    sendError(res, 'Access denied', 403);
    return;
  }

  comment.content = req.body.content;
  await comment.save();
  await comment.populate('author', 'name email role');

  sendSuccess(res, comment, 'Comment updated');
};

export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const ticket = await Ticket.findOne(ticketIdFilter(req.params.ticketId));
  if (!ticket) {
    sendError(res, 'Ticket not found', 404);
    return;
  }

  const comment = await Comment.findOne({
    _id: req.params.commentId,
    ticket: ticket._id,
  });
  if (!comment) {
    sendError(res, 'Comment not found', 404);
    return;
  }

  if (comment.author.toString() !== req.user!.id && req.user!.role !== UserRole.ADMIN) {
    sendError(res, 'Access denied', 403);
    return;
  }

  const { ticket: commentTicket, isInternal } = comment;
  const ticketId = commentTicket.toString();
  const commentId = comment._id.toString();

  await comment.deleteOne();
  emitCommentDeleted({ ticketId, commentId, isInternal });
  sendSuccess(res, null, 'Comment deleted');
};
