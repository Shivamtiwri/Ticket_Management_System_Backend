import { body, query } from 'express-validator';
import { UserRole } from '../types';

const isValidPhone = (value: string): boolean => {
  const digits = value.replace(/\D/g, '');
  return /^\+?[\d\s()-]{7,20}$/.test(value) && digits.length >= 7 && digits.length <= 15;
};

export const updateUserValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('phone').optional({ values: 'falsy' }).trim().custom(isValidPhone).withMessage('Valid phone number required, e.g. +1 555 000 0000'),
  body('department').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Department cannot exceed 100 characters'),
];

export const updateRoleValidator = [
  body('role').notEmpty().withMessage('Role is required').isIn(Object.values(UserRole)).withMessage('Invalid role'),
];

export const changePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').notEmpty().withMessage('New password is required').isLength({ min: 8 }).withMessage('Password must be at least 8 characters').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase and number').custom((value, { req }) => value !== (req.body as { currentPassword?: string }).currentPassword).withMessage('New password must be different from current password'),
];

export const userListQueryValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  query('role').optional().isIn(Object.values(UserRole)).withMessage('Invalid role'),
  query('isActive').optional().isBoolean({ loose: true }).withMessage('isActive must be a boolean'),
  query('search').optional().trim().isLength({ max: 200 }).withMessage('Search term must be at most 200 characters'),
];
