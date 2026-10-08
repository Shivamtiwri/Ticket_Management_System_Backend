import { query } from 'express-validator';
import { ActivityAction } from '../types';

export const activityQueryValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  query('action').optional().isIn(Object.values(ActivityAction)).withMessage('Invalid activity action'),
  query('actorId').optional().isMongoId().withMessage('Invalid actor ID'),
  query('search').optional().trim().isLength({ max: 200 }).withMessage('Search term must be at most 200 characters'),
];
