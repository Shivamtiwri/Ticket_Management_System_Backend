import { Response } from 'express';
import { Ticket } from '../models/Ticket';
import { User } from '../models/User';
import { AuthRequest, TicketStatus } from '../types';
import { sendSuccess } from '../utils/apiResponse';
import { Category } from '../models/Category';

export const getCustomerDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const baseFilter = { createdBy: userId };

  const [total, open, inProgress, resolved, closed] = await Promise.all([
    Ticket.countDocuments(baseFilter),
    Ticket.countDocuments({ ...baseFilter, status: TicketStatus.OPEN }),
    Ticket.countDocuments({ ...baseFilter, status: TicketStatus.IN_PROGRESS }),
    Ticket.countDocuments({ ...baseFilter, status: TicketStatus.RESOLVED }),
    Ticket.countDocuments({ ...baseFilter, status: TicketStatus.CLOSED }),
  ]);

  const recentTickets = await Ticket.find(baseFilter)
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();

  sendSuccess(res, { stats: { total, open, inProgress, resolved, closed }, recentTickets });
};

export const getAgentDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const baseFilter = { assignedAgent: userId };

  const [assigned, open, inProgress, waitingForUser, resolved] = await Promise.all([
    Ticket.countDocuments(baseFilter),
    Ticket.countDocuments({ ...baseFilter, status: TicketStatus.OPEN }),
    Ticket.countDocuments({ ...baseFilter, status: TicketStatus.IN_PROGRESS }),
    Ticket.countDocuments({ ...baseFilter, status: TicketStatus.WAITING_FOR_USER }),
    Ticket.countDocuments({ ...baseFilter, status: TicketStatus.RESOLVED }),
  ]);

  const recentTickets = await Ticket.find(baseFilter)
    .populate('createdBy', 'name email')
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();

  sendSuccess(res, { stats: { assigned, open, inProgress, waitingForUser, resolved }, recentTickets });
};

export const getAdminDashboard = async (_req: AuthRequest, res: Response): Promise<void> => {
  const [total, open, inProgress, resolved, closed,total_category] = await Promise.all([
    Ticket.countDocuments(),
    Ticket.countDocuments({ status: TicketStatus.OPEN }),
    Ticket.countDocuments({ status: TicketStatus.IN_PROGRESS }),
    Ticket.countDocuments({ status: TicketStatus.RESOLVED }),
    Ticket.countDocuments({ status: TicketStatus.CLOSED }),
    Category.countDocuments(),

  ]);

  const [byPriority, byCategory, byAgent, userStats] = await Promise.all([
    Ticket.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Ticket.aggregate([
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'cat' } },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$cat.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Ticket.aggregate([
      { $match: { assignedAgent: { $exists: true } } },
      { $lookup: { from: 'users', localField: 'assignedAgent', foreignField: '_id', as: 'agent' } },
      { $unwind: '$agent' },
      { $group: { _id: '$agent.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
  ]);

  sendSuccess(res, {
    stats: { total, open, inProgress, resolved, closed,total_category },
    byPriority,
    byCategory,
    byAgent,
    userStats,
  });
};
