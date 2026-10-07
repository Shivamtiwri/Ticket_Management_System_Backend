
import { Response } from 'express';
import { ActivityLog } from '../models/ActivityLog';
import { AuthRequest } from '../types';
import { sendPaginated, sendSuccess } from '../utils/apiResponse';

export const getActivityLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const ticketId = req.query.ticketId as string | undefined;
  const actorId = req.query.actorId as string | undefined;
  const action = req.query.action as string | undefined;

  const filter: Record<string, unknown> = {};
  if (ticketId) filter.ticket = ticketId;
  if (actorId) filter.actor = actorId;
  if (action) filter.action = action;



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
  const logs = await ActivityLog.find({ ticket: req.params.ticketId })
    .populate('actor', 'name email role')
    .sort({ createdAt: 1 })
    .lean();

  sendSuccess(res, logs);
};
