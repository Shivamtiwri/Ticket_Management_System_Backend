import { body } from 'express-validator';

export const createCommentValidator = [
  body('content').trim().notEmpty().withMessage('Comment content is required').isLength({ min: 1, max: 5000 }).withMessage('Comment must be 1-5000 characters'),
  body('isInternal').optional({ values: 'falsy' }).isBoolean({ loose: true }).withMessage('isInternal must be a boolean').toBoolean(),
];
