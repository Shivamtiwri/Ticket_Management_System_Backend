// Removed: only Register, Login and Dashboard functionality is kept in this file.
import { body } from 'express-validator';

export const createCommentValidator = [
  body('content').trim().notEmpty().withMessage('Comment content is required').isLength({ min: 1, max: 5000 }).withMessage('Comment must be 1-5000 characters'),
  body('isInternal').optional().isBoolean().withMessage('isInternal must be a boolean'),
];
