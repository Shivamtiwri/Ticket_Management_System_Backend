import http from 'http';
import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { User } from '../models/User';
import { Ticket } from '../models/Ticket';
import { IComment, UserRole } from '../types';
import { logger } from '../utils/logger';

interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

interface SocketUser extends JwtPayload {}

export interface CommentDeletedPayload {
  ticketId: string;
  commentId: string;
  isInternal: boolean;
}

interface ServerToClientEvents {
  'ticket:error': (payload: { message: string }) => void;
  'comment:new': (comment: unknown) => void;
  'comment:deleted': (payload: CommentDeletedPayload) => void;
}

interface ClientToServerEvents {
  'ticket:join': (payload: { ticketId: string }) => void;
  'ticket:leave': (payload: { ticketId: string }) => void;
}

interface InterServerEvents {}

interface SocketData {
  user?: SocketUser;
}

const ticketRoom = (ticketId: string): string => `ticket:${ticketId}`;
const staffRoom = (ticketId: string): string => `ticket:${ticketId}:staff`;

let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

const authenticate = async (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    const auth = socket.handshake.auth as { token?: string } | undefined;
    const header = socket.handshake.headers.authorization;
    const token = auth?.token || (header?.startsWith('Bearer ') ? header.slice(7) : undefined);

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as JwtPayload;

    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      next(new Error('User not found or inactive'));
      return;
    }

    socket.data.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    next();
  } catch {
    next(new Error('Invalid token'));
  }
};

export const initSocket = (
  httpServer: http.Server
): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> => {
  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use(authenticate);

  io.on('connection', (socket) => {
    const user = socket.data.user!;
    logger.info(`Socket connected: user=${user.id} (${user.role})`);

    socket.on('ticket:join', async (payload) => {
      const ticketId = payload?.ticketId;
      if (!ticketId) {
        socket.emit('ticket:error', { message: 'ticketId is required' });
        return;
      }

      try {
        const ticket = await Ticket.findById(ticketId).select('createdBy');
        if (!ticket) {
          socket.emit('ticket:error', { message: 'Ticket not found' });
          return;
        }

        const isStaff = user.role !== UserRole.CUSTOMER;
        const isOwner = ticket.createdBy.toString() === user.id;
        if (!isStaff && !isOwner) {
          socket.emit('ticket:error', { message: 'Access denied' });
          return;
        }

        socket.join(ticketRoom(ticketId));
        if (isStaff) socket.join(staffRoom(ticketId));
      } catch {
        socket.emit('ticket:error', { message: 'Unable to join ticket room' });
      }
    });

    socket.on('ticket:leave', (payload) => {
      const ticketId = payload?.ticketId;
      if (!ticketId) return;
      socket.leave(ticketRoom(ticketId));
      socket.leave(staffRoom(ticketId));
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user=${user.id}`);
    });
  });

  return io;
};

export const emitCommentCreated = (comment: IComment): void => {
  if (!io) return;
  const ticketId = comment.ticket.toString();
  const payload = comment.toObject();
  if (comment.isInternal) {
    io.to(staffRoom(ticketId)).emit('comment:new', payload);
  } else {
    io.to(ticketRoom(ticketId)).emit('comment:new', payload);
  }
};

export const emitCommentDeleted = (payload: CommentDeletedPayload): void => {
  if (!io) return;
  const room = payload.isInternal ? staffRoom(payload.ticketId) : ticketRoom(payload.ticketId);
  io.to(room).emit('comment:deleted', payload);
};