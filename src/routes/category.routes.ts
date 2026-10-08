import { Router } from 'express';
import {
  getCategories, getActiveCategories, createCategory,
  updateCategory, deleteCategory, toggleCategoryStatus,
} from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createCategoryValidator, updateCategoryValidator, categoryIdValidator } from '../validators/category.validators';
import { UserRole } from '../types';

const router = Router();

router.get('/active', getActiveCategories);
router.use(authenticate);
router.get('/', getCategories);
router.post('/', authorize(UserRole.ADMIN), validate(createCategoryValidator), createCategory);
router.put('/:id', authorize(UserRole.ADMIN), validate([...categoryIdValidator, ...updateCategoryValidator]), updateCategory);
router.patch('/:id/toggle-status', authorize(UserRole.ADMIN), validate(categoryIdValidator), toggleCategoryStatus);
router.delete('/:id', authorize(UserRole.ADMIN), validate(categoryIdValidator), deleteCategory);

export default router;
