import { Router } from 'express';
import {
  getCategories, getActiveCategories, createCategory,
  updateCategory, deleteCategory, toggleCategoryStatus,
} from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

router.get('/active', getActiveCategories);
router.use(authenticate);
router.get('/', getCategories);
router.post('/', authorize(UserRole.ADMIN), createCategory);
router.put('/:id', authorize(UserRole.ADMIN), updateCategory);
router.patch('/:id/toggle-status', authorize(UserRole.ADMIN), toggleCategoryStatus);
router.delete('/:id', authorize(UserRole.ADMIN), deleteCategory);

export default router;
