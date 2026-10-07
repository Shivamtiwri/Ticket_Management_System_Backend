import { Response } from 'express';
import { User } from '../models/User';
import { ActivityLog } from '../models/ActivityLog';
import { AuthRequest, UserRole, ActivityAction } from '../types';
import { sendSuccess, sendError, sendPaginated } from '../utils/apiResponse';

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const role = req.query.role as UserRole | undefined;
  const search = req.query.search as string | undefined;
  const isActive = req.query.isActive as string | undefined;

  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  sendPaginated(res, users, total, page, limit);
};

export const getAgents = async (_req: AuthRequest, res: Response): Promise<void> => {
  const agents = await User.find({ role: UserRole.AGENT, isActive: true }).sort({ name: 1 });
  sendSuccess(res, agents);
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id);
  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }
  sendSuccess(res, user);
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, phone, department } = req.body;
  const userId = req.params.id || req.user!.id;

  const isAdmin = req.user!.role === UserRole.ADMIN;
  if (!isAdmin && userId !== req.user!.id) {
    sendError(res, 'Unauthorized', 403);
    return;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { name, phone, department },
    { new: true, runValidators: true }
  );

  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }

  sendSuccess(res, user, 'User updated successfully');
};

export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  const { role } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  );

  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }

  await ActivityLog.create({
    actor: req.user!.id,
    action: ActivityAction.USER_UPDATED,
    description: `User ${user.name} role changed to ${role}`,
    metadata: { userId: user._id, newRole: role },
  });

  sendSuccess(res, user, 'User role updated');
};

export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id);
  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }

  user.isActive = !user.isActive;
  await user.save();

  await ActivityLog.create({
    actor: req.user!.id,
    action: user.isActive ? ActivityAction.USER_ACTIVATED : ActivityAction.USER_DEACTIVATED,
    description: `User ${user.name} ${user.isActive ? 'activated' : 'deactivated'}`,
    metadata: { userId: user._id },
  });

  sendSuccess(res, user, `User ${user.isActive ? 'activated' : 'deactivated'} successfully`);
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  req.params.id = req.user!.id;
  return updateUser(req, res);
};
