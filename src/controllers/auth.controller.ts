import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { ActivityLog } from '../models/ActivityLog';
import { AuthRequest, ActivityAction } from '../types';
import { sendSuccess, sendCreated, sendError } from '../utils/apiResponse';

const generateToken = (user: { id: string; email: string; role: string; name: string }) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, phone } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    sendError(res, 'Email already registered', 409);
    return;
  }

  const user = await User.create({ name, email, password, phone });

  await ActivityLog.create({
    actor: user._id,
    action: ActivityAction.USER_CREATED,
    description: `User ${user.name} registered`,
    metadata: { email: user.email, role: user.role },
  });

  const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role, name: user.name });

  sendCreated(res, {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }, 'Registration successful');
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    sendError(res, 'Invalid email or password', 401);
    return;
  }

  if (!user.isActive) {
    sendError(res, 'Account is deactivated. Please contact support.', 403);
    return;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    sendError(res, 'Invalid email or password', 401);
    return;
  }

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role, name: user.name });

  sendSuccess(res, {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }, 'Login successful');
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.user!.id);
  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }
  sendSuccess(res, user);
};

export const logout = async (_req: AuthRequest, res: Response): Promise<void> => {
  sendSuccess(res, null, 'Logged out successfully');
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user!.id).select('+password');
  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    sendError(res, 'Current password is incorrect', 400);
    return;
  }

  user.password = newPassword;
  await user.save();

  sendSuccess(res, null, 'Password changed successfully');
};
