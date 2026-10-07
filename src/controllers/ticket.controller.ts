import { Response } from 'express';
import { Ticket } from '../models/Ticket';
import { ActivityLog } from '../models/ActivityLog';
import { AuthRequest, UserRole, TicketStatus, ActivityAction } from '../types';
import { sendSuccess, sendCreated, sendError, sendPaginated } from '../utils/apiResponse';
import { isValidTransition } from '../utils/statusTransitions';

const getSortOptions = (sortBy?: string): Record<string, 1 | -1> => {
    switch (sortBy) {
        case 'oldest': return { createdAt: 1 };
        case 'updated': return { updatedAt: -1 };
        case 'priority':
            return { createdAt: -1 };
        default: return { createdAt: -1 };
    }
};

const PRIORITY_ORDER: Record<string, number> = {
    CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1,
};

const buildTicketFilter = (query: Record<string, string>, userId?: string, role?: UserRole) => {
    const filter: Record<string, unknown> = {};

    if (role === UserRole.CUSTOMER) {
        filter.createdBy = userId;
    } else if (role === UserRole.AGENT) {
        filter.assignedAgent = userId;
    }

    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.category) filter.category = query.category;
    if (query.assignedAgent) filter.assignedAgent = query.assignedAgent;

    if (query.search) {
        filter.$text = { $search: query.search };
    }

    return filter;
};



export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    const { subject, description, category, priority, tags } = req.body;
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

    const ticket = await Ticket.create({
        subject,
        description,
        category,
        priority,
        tags,
        createdBy: req.user!.id,
        attachments,
    });

    await ticket.populate(['category', 'createdBy']);

    await ActivityLog.create({
        ticket: ticket._id,
        actor: req.user!.id,
        action: ActivityAction.TICKET_CREATED,
        description: `Ticket "${ticket.subject}" created`,
        metadata: { ticketId: ticket.ticketId, priority, category },
    });

    sendCreated(res, ticket, 'Ticket created successfully');
};

export const getTickets = async (req: AuthRequest, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = req.query.sortBy as string;

    const filter = buildTicketFilter(
        req.query as Record<string, string>,
        req.user!.id,
        req.user!.role
    );

    const sortOptions = getSortOptions(sortBy);

    const [tickets, total] = await Promise.all([
        Ticket.find(filter)
            .populate('category', 'name')
            .populate('createdBy', 'name email role')
            .populate('assignedAgent', 'name email')
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Ticket.countDocuments(filter),
    ]);

    if (sortBy === 'priority') {
        tickets.sort((a, b) => (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0));
    }

    sendPaginated(res, tickets, total, page, limit);
};

export const getTicketById = async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const ticket = await Ticket.findOne({
        $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { ticketId: id }],
    })
        .populate('category', 'name description')
        .populate('createdBy', 'name email role')
        .populate('assignedAgent', 'name email')
        .populate('attachments.uploadedBy', 'name');

    if (!ticket) {
        sendError(res, 'Ticket not found', 404);
        return;
    }


    if (req.user!.role === UserRole.CUSTOMER && ticket.createdBy._id.toString() !== req.user!.id) {
        sendError(res, 'Access denied', 403);
        return;
    }

    sendSuccess(res, ticket);
};

export const updateTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
        sendError(res, 'Ticket not found', 404);
        return;
    }


    if (req.user!.role === UserRole.CUSTOMER && ticket.createdBy.toString() !== req.user!.id) {
        sendError(res, 'Access denied', 403);
        return;
    }

    const { subject, description, priority, status, tags } = req.body;
    const changes: string[] = [];


    if (status && status !== ticket.status) {
        if (!isValidTransition(ticket.status, status as TicketStatus, req.user!.role)) {
            sendError(res, `Invalid status transition from ${ticket.status} to ${status}`, 400);
            return;
        }
        changes.push(`Status changed from ${ticket.status} to ${status}`);
        ticket.status = status;
        if (status === TicketStatus.RESOLVED) ticket.resolvedAt = new Date();
        if (status === TicketStatus.CLOSED) ticket.closedAt = new Date();
    }

    if (priority && priority !== ticket.priority) {
        changes.push(`Priority changed from ${ticket.priority} to ${priority}`);
        ticket.priority = priority;
    }

    if (subject) ticket.subject = subject;
    if (description) ticket.description = description;
    if (tags) ticket.tags = tags;

    await ticket.save();
    await ticket.populate(['category', 'createdBy', 'assignedAgent']);

    if (changes.length > 0) {
        await ActivityLog.create({
            ticket: ticket._id,
            actor: req.user!.id,
            action: status ? ActivityAction.STATUS_CHANGED : ActivityAction.TICKET_UPDATED,
            description: changes.join('; '),
            metadata: { changes },
        });
    }

    sendSuccess(res, ticket, 'Ticket updated successfully');
};

export const assignTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    const { agentId } = req.body;


    if (req.user!.role === UserRole.AGENT && agentId !== req.user!.id) {
        sendError(res, 'Agents can only assign tickets to themselves', 403);
        return;
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
        sendError(res, 'Ticket not found', 404);
        return;
    }

    const previousAgent = ticket.assignedAgent?.toString();
    ticket.assignedAgent = agentId;
    if (ticket.status === TicketStatus.OPEN) {
        ticket.status = TicketStatus.ASSIGNED;
    }
    await ticket.save();
    await ticket.populate(['assignedAgent', 'createdBy', 'category']);

    await ActivityLog.create({
        ticket: ticket._id,
        actor: req.user!.id,
        action: previousAgent ? ActivityAction.TICKET_REASSIGNED : ActivityAction.TICKET_ASSIGNED,
        description: previousAgent
            ? `Ticket reassigned to new agent`
            : `Ticket assigned to agent`,
        metadata: { previousAgent, newAgent: agentId },
    });

    sendSuccess(res, ticket, 'Ticket assigned successfully');
};

export const deleteTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) {
        sendError(res, 'Ticket not found', 404);
        return;
    }
    sendSuccess(res, null, 'Ticket deleted successfully');
};

export const getAvailableTickets = async (req: AuthRequest, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const filter: Record<string, unknown> = {
        status: TicketStatus.OPEN,
        assignedAgent: { $exists: false },
    };

    const [tickets, total] = await Promise.all([
        Ticket.find(filter)
            .populate('category', 'name')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Ticket.countDocuments(filter),
    ]);

    sendPaginated(res, tickets, total, page, limit);
};
