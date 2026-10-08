import { body, param } from 'express-validator';

export const createCategoryValidator = [
  body('name').trim().notEmpty().withMessage('Category name is required').isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
];

export const updateCategoryValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('isActive').optional().isBoolean({ loose: true }).withMessage('isActive must be a boolean').toBoolean(),
];

export const categoryIdValidator = [
  param('id').isMongoId().withMessage('Invalid category ID'),
];
