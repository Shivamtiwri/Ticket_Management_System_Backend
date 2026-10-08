import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error & {
    statusCode?: number;
    code?: number;
    keyValue?: Record<string, string>;
    type?: string;
    path?: string;
    code2?: string;
  },
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error:', { message: err.message, stack: err.stack });

  if (err.code === 11000 && err.keyValue) {
    const field = Object.keys(err.keyValue)[0];
    const label = field.charAt(0).toUpperCase() + field.slice(1);
    res.status(409).json({
      success: false,
      message: `${label} already exists`,
    });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      message: `Invalid value for "${err.path}"`,
      errors: [{ field: err.path || 'unknown', message: `Invalid value for "${err.path}"` }],
    });
    return;
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values((err as any).errors).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
    res.status(400).json({ success: false, message: 'Validation failed', errors });
    return;
  }

  if (err.name === 'MulterError') {
    const multerCode = (err as any).code as string | undefined;
    const message =
      multerCode === 'LIMIT_FILE_SIZE'
        ? 'File is too large. Maximum allowed size is 5 MB per file'
        : multerCode === 'LIMIT_FILE_COUNT'
          ? 'Too many files. Maximum allowed is 5 files'
          : multerCode === 'LIMIT_UNEXPECTED_FILE'
            ? 'Unexpected file field'
            : 'File upload failed';
    const statusCode = multerCode === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(statusCode).json({ success: false, message });
    return;
  }

  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    return;
  }

  if (err.type === 'entity.too.large') {
    res.status(413).json({ success: false, message: 'Request payload is too large' });
    return;
  }

  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ success: false, message: 'Invalid token' });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ success: false, message: 'Token expired' });
    return;
  }

  const statusCode = (err as AppError).statusCode || 500;
  const message =
    (err as AppError).isOperational || process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error';

  res.status(statusCode).json({ success: false, message });
};

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Route not found' });
};
