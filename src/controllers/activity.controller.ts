
import { Response } from 'express';
import { ActivityLog } from '../models/ActivityLog';
import { Ticket } from '../models/Ticket';
import { AuthRequest, UserRole } from '../types';
import { sendPaginated, sendSuccess, sendError } from '../utils/apiResponse';
import { buildSearchRegex, isObjectIdString, ticketIdFilter } from '../utils/queryUtils';
import { canAccessCategory } from '../utils/categoryVisibility';

export const getActivityLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const ticketId = req.query.ticketId as string | undefined;
  const actorId = req.query.actorId as string | undefined;
  const action = req.query.action as string | undefined;
  const search = req.query.search as string | undefined;

  const filter: Record<string, unknown> = {};
  if (actorId) filter.actor = actorId;
  if (action) filter.action = action;

  if (ticketId) {
    if (isObjectIdString(ticketId)) {
      filter.ticket = ticketId;
    } else {
      const ticket = await Ticket.findOne(ticketIdFilter(ticketId)).select('_id');
      if (!ticket) {
        sendPaginated(res, [], 0, page, limit);
        return;
      }
      filter.ticket = ticket._id;
    }
  }

  if (search) {
    const searchRegex = buildSearchRegex(search);
    filter.$or = [{ description: searchRegex }, { 'metadata.ticketId': searchRegex }];
  }

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter)
      .populate('actor', 'name email role')
      .populate('ticket', 'ticketId subject')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  sendPaginated(res, logs, total, page, limit);
};

export const getTicketActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  const ticket = await Ticket.findOne(ticketIdFilter(req.params.ticketId));
  if (!ticket) {
    sendError(res, 'Ticket not found', 404);
    return;
  }

  if (!await canAccessCategory(ticket.category, req.user!.role)) {
    sendError(res, 'Ticket not found', 404);
    return;
  }

  if (req.user!.role === UserRole.CUSTOMER && ticket.createdBy.toString() !== req.user!.id) {
    sendError(res, 'Access denied', 403);
    return;
  }

  const logs = await ActivityLog.find({ ticket: ticket._id })
    .populate('actor', 'name email role')
    .sort({ createdAt: 1 })
    .lean();

  sendSuccess(res, logs);
};
