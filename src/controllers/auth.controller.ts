import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User';
import { ActivityLog } from '../models/ActivityLog';
import { AuthRequest, ActivityAction } from '../types';
import { sendSuccess, sendCreated, sendError } from '../utils/apiResponse';

/* ─── token helpers ─────────────────────────────────────────────────────── */

const generateAccessToken = (user: {
  id: string;
  email: string;
  role: string;
  name: string;
}): string => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
  );
};

/**
 * Generates a cryptographically random refresh token string and its expiry date.
 * The token is stored hashed in the DB but returned plain to the client.
 */
const generateRefreshToken = (): { token: string; expiry: Date } => {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresInDays = parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '30', 10);
  const expiry = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  return { token, expiry };
};

/** Writes the refresh token into a secure httpOnly cookie */
const setRefreshCookie = (res: Response, token: string, expiry: Date): void => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: expiry,
    path: '/api/auth', // only sent to auth endpoints
  });
};

/** Clears the refresh token cookie */
const clearRefreshCookie = (res: Response): void => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
};

/* ─── controllers ───────────────────────────────────────────────────────── */

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

  const accessToken = generateAccessToken({
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const { token: refreshToken, expiry: refreshTokenExpiry } = generateRefreshToken();

  // Store refresh token in DB
  user.refreshToken = refreshToken;
  user.refreshTokenExpiry = refreshTokenExpiry;
  await user.save();

  setRefreshCookie(res, refreshToken, refreshTokenExpiry);

  sendCreated(res, {
    token: accessToken,
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

  const user = await User.findOne({ email }).select('+password +refreshToken +refreshTokenExpiry');
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

  const accessToken = generateAccessToken({
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const { token: refreshToken, expiry: refreshTokenExpiry } = generateRefreshToken();

  // Rotate: replace any existing refresh token
  user.refreshToken = refreshToken;
  user.refreshTokenExpiry = refreshTokenExpiry;
  await user.save();

  setRefreshCookie(res, refreshToken, refreshTokenExpiry);

  sendSuccess(res, {
    token: accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }, 'Login successful');
};

/**
 * POST /auth/refresh
 * Reads the refresh token from the httpOnly cookie, validates it against the DB,
 * issues a new access token and rotates the refresh token.
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  const incomingToken: string | undefined = req.cookies?.refreshToken;

  if (!incomingToken) {
    sendError(res, 'Refresh token missing', 401);
    return;
  }

  // Look up user by refresh token
  const user = await User.findOne({
    refreshToken: incomingToken,
    refreshTokenExpiry: { $gt: new Date() }, // not expired
  });

  if (!user || !user.isActive) {
    // Token reuse or invalid — clear cookie
    clearRefreshCookie(res);
    sendError(res, 'Invalid or expired refresh token', 401);
    return;
  }

  // Rotate refresh token
  const { token: newRefreshToken, expiry: newRefreshExpiry } = generateRefreshToken();
  user.refreshToken = newRefreshToken;
  user.refreshTokenExpiry = newRefreshExpiry;
  await user.save();

  setRefreshCookie(res, newRefreshToken, newRefreshExpiry);

  const accessToken = generateAccessToken({
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
  });

  sendSuccess(res, {
    token: accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }, 'Token refreshed');
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.user!.id);
  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }
  sendSuccess(res, user);
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  // Revoke the refresh token stored in DB
  const incomingToken: string | undefined = req.cookies?.refreshToken;
  if (incomingToken) {
    await User.findOneAndUpdate(
      { refreshToken: incomingToken },
      { $unset: { refreshToken: '', refreshTokenExpiry: '' } }
    );
  }

  clearRefreshCookie(res);
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
