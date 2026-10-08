
import { Router } from 'express';
import {
  createTicket, getTickets, getTicketById, updateTicket,
  assignTicket, deleteTicket, getAvailableTickets,
} from '../controllers/ticket.controller';
import { getComments, addComment, updateComment, deleteComment } from '../controllers/comment.controller';
import { getTicketActivity } from '../controllers/activity.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createTicketValidator, updateTicketValidator, ticketQueryValidator, assignTicketValidator, availableTicketsQueryValidator } from '../validators/ticket.validators';
import { createCommentValidator } from '../validators/comment.validators';
import { uploadFiles } from '../middleware/upload';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);

router.get('/available', authorize(UserRole.AGENT, UserRole.ADMIN), validate(availableTicketsQueryValidator), getAvailableTickets);
router.get('/', validate(ticketQueryValidator), getTickets);
router.post('/', uploadFiles, validate(createTicketValidator), createTicket);
router.get('/:id', getTicketById);
router.put('/:id', validate(updateTicketValidator), updateTicket);
router.patch('/:id', validate(updateTicketValidator), updateTicket);
router.patch('/:id/assign', authorize(UserRole.AGENT, UserRole.ADMIN), validate(assignTicketValidator), assignTicket);
router.delete('/:id', authorize(UserRole.ADMIN), deleteTicket);

router.get('/:ticketId/comments', getComments);
router.post('/:ticketId/comments', uploadFiles, validate(createCommentValidator), addComment);
router.put('/:ticketId/comments/:commentId', validate(createCommentValidator), updateComment);
router.delete('/:ticketId/comments/:commentId', deleteComment);

router.get('/:ticketId/activity', getTicketActivity);

export default router;
