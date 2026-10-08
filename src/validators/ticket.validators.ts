import { body, query } from 'express-validator';
import { TicketPriority, TicketStatus } from '../types';

export const createTicketValidator = [
  body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ min: 5, max: 200 }).withMessage('Subject must be 5-200 characters'),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ min: 20, max: 5000 }).withMessage('Description must be 20-5000 characters'),
  body('category').notEmpty().withMessage('Category is required').isMongoId().withMessage('Invalid category ID'),
  body('priority').notEmpty().withMessage('Priority is required').isIn(Object.values(TicketPriority)).withMessage('Invalid priority value'),
];

export const updateTicketValidator = [
  body('subject').optional().trim().isLength({ min: 5, max: 200 }).withMessage('Subject must be 5-200 characters'),
  body('description').optional().trim().isLength({ min: 20, max: 5000 }).withMessage('Description must be 20-5000 characters'),
  body('priority').optional().isIn(Object.values(TicketPriority)).withMessage('Invalid priority value'),
  body('status').optional().isIn(Object.values(TicketStatus)).withMessage('Invalid status value'),
];

export const assignTicketValidator = [
  body('agentId').notEmpty().withMessage('Agent is required').isMongoId().withMessage('Invalid agent ID'),
];

export const ticketQueryValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  query('status').optional().isIn(Object.values(TicketStatus)).withMessage('Invalid status'),
  query('priority').optional().isIn(Object.values(TicketPriority)).withMessage('Invalid priority'),
  query('sortBy').optional().isIn(['newest', 'oldest', 'updated', 'priority']).withMessage('Invalid sort option'),
  query('category').optional().isMongoId().withMessage('Invalid category ID'),
  query('assignedAgent').optional().isMongoId().withMessage('Invalid agent ID'),
  query('search').optional().trim().isLength({ max: 200 }).withMessage('Search term must be at most 200 characters'),
];

export const availableTicketsQueryValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
];
