import { body } from 'express-validator';
import { UserRole } from '../types';

export const updateUserValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('phone').optional().trim().isMobilePhone('any').withMessage('Valid phone number required'),
  body('department').optional().trim().isLength({ max: 100 }).withMessage('Department cannot exceed 100 characters'),
];

export const updateRoleValidator = [
  body('role').notEmpty().withMessage('Role is required').isIn(Object.values(UserRole)).withMessage('Invalid role'),
];

export const changePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').notEmpty().withMessage('New password is required').isLength({ min: 8 }).withMessage('Password must be at least 8 characters').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase and number'),
];
