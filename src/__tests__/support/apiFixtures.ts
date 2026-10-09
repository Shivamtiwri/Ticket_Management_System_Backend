import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import mongoose, { Types } from 'mongoose';
import { ActivityLog } from '../../models/ActivityLog';
import { Category } from '../../models/Category';
import { Comment } from '../../models/Comment';
import { Ticket } from '../../models/Ticket';
import { User } from '../../models/User';
import { TicketPriority, TicketStatus, UserRole } from '../../types';

export const dbIntegrationEnabled = Boolean(process.env.TEST_MONGODB_URI);

export class ApiFixtures {
  private readonly users: Types.ObjectId[] = [];
  private readonly categories: Types.ObjectId[] = [];
  private readonly tickets: Types.ObjectId[] = [];
  private readonly comments: Types.ObjectId[] = [];
  private readonly suffix = randomUUID();

  async createUser(role = UserRole.CUSTOMER) {
    const user = await User.create({
      name: `Test ${role}`,
      email: `${role.toLowerCase()}-${randomUUID()}@example.test`,
      password: 'TestPassword123',
      role,
    });
    this.users.push(user._id);
    return user;
  }

  async createCategory(createdBy: Types.ObjectId, active = true) {
    const category = await Category.create({
      name: `QA ${this.suffix} ${this.categories.length}`,
      description: 'Category created by isolated API integration tests',
      createdBy,
      isActive: active,
    });
    this.categories.push(category._id);
    return category;
  }

  async createTicket(
    createdBy: Types.ObjectId,
    category: Types.ObjectId,
    overrides: Partial<{
      subject: string;
      description: string;
      status: TicketStatus;
      priority: TicketPriority;
      assignedAgent: Types.ObjectId;
    }> = {}
  ) {
    const ticket = await Ticket.create({
      subject: overrides.subject || 'Test ticket subject',
      description: overrides.description || 'This description is long enough for a valid test ticket.',
      category,
      createdBy,
      status: overrides.status || TicketStatus.OPEN,
      priority: overrides.priority || TicketPriority.MEDIUM,
      ...(overrides.assignedAgent ? { assignedAgent: overrides.assignedAgent } : {}),
    });
    this.tickets.push(ticket._id);
    return ticket;
  }

  async createComment(ticket: Types.ObjectId, author: Types.ObjectId, isInternal = false) {
    const comment = await Comment.create({
      ticket,
      author,
      content: `Test comment ${randomUUID()}`,
      isInternal,
    });
    this.comments.push(comment._id);
    return comment;
  }

  trackUserId(id: string): void {
    this.users.push(new Types.ObjectId(id));
  }

  trackCategoryId(id: string): void {
    this.categories.push(new Types.ObjectId(id));
  }

  trackTicketId(id: string): void {
    this.tickets.push(new Types.ObjectId(id));
  }

  trackCommentId(id: string): void {
    this.comments.push(new Types.ObjectId(id));
  }

  tokenFor(user: { _id: Types.ObjectId; email: string; role: UserRole; name: string }): string {
    return jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET as string,
      { expiresIn: '10m' }
    );
  }

  authorization(user: { _id: Types.ObjectId; email: string; role: UserRole; name: string }) {
    return `Bearer ${this.tokenFor(user)}`;
  }

  async cleanup(): Promise<void> {
    if (this.tickets.length) {
      await ActivityLog.deleteMany({ ticket: { $in: this.tickets } });
      await Comment.deleteMany({ ticket: { $in: this.tickets } });
      await Ticket.deleteMany({ _id: { $in: this.tickets } });
    }
    if (this.comments.length) {
      await Comment.deleteMany({ _id: { $in: this.comments } });
    }
    if (this.users.length) {
      await ActivityLog.deleteMany({ actor: { $in: this.users } });
      await User.deleteMany({ _id: { $in: this.users } });
    }
    if (this.categories.length) {
      await Category.deleteMany({ _id: { $in: this.categories } });
    }
  }
}

export const ensureDatabaseConnected = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB test connection is not established.');
  }
};
