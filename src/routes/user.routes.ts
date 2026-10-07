import { Router } from 'express';
import {
  getUsers, getAgents, getUserById, updateUser, updateUserRole,
  toggleUserStatus, updateProfile,
} from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateUserValidator, updateRoleValidator } from '../validators/user.validators';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);

router.get('/', authorize(UserRole.ADMIN), getUsers);
router.get('/agents', authorize(UserRole.ADMIN), getAgents);
router.put('/profile', validate(updateUserValidator), updateProfile);
router.get('/:id', authorize(UserRole.ADMIN), getUserById);
router.put('/:id', authorize(UserRole.ADMIN), validate(updateUserValidator), updateUser);
router.patch('/:id/role', authorize(UserRole.ADMIN), validate(updateRoleValidator), updateUserRole);
router.patch('/:id/toggle-status', authorize(UserRole.ADMIN), toggleUserStatus);

export default router;
