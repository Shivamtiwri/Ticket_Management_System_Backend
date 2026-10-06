// Removed: only Register, Login and Dashboard functionality is kept in this file.
import { Response } from 'express';
import { Category } from '../models/Category';
import { ActivityLog } from '../models/ActivityLog';
import { AuthRequest, ActivityAction } from '../types';
import { sendSuccess, sendCreated, sendError } from '../utils/apiResponse';

export const getCategories = async (_req: AuthRequest, res: Response): Promise<void> => {
  const categories = await Category.find().sort({ name: 1 });
  sendSuccess(res, categories);
};

export const getActiveCategories = async (_req: AuthRequest, res: Response): Promise<void> => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  sendSuccess(res, categories);
};

export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description } = req.body;

  const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
  if (existing) {
    sendError(res, 'Category with this name already exists', 409);
    return;
  }

  const category = await Category.create({ name, description, createdBy: req.user!.id });

  await ActivityLog.create({
    actor: req.user!.id,
    action: ActivityAction.CATEGORY_CREATED,
    description: `Category "${category.name}" created`,
    metadata: { categoryId: category._id },
  });

  sendCreated(res, category, 'Category created successfully');
};

export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, isActive } = req.body;
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { name, description, isActive },
    { new: true, runValidators: true }
  );

  if (!category) {
    sendError(res, 'Category not found', 404);
    return;
  }

  await ActivityLog.create({
    actor: req.user!.id,
    action: ActivityAction.CATEGORY_UPDATED,
    description: `Category "${category.name}" updated`,
    metadata: { categoryId: category._id },
  });

  sendSuccess(res, category, 'Category updated successfully');
};

export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) {
    sendError(res, 'Category not found', 404);
    return;
  }
  sendSuccess(res, null, 'Category deleted successfully');
};

export const toggleCategoryStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    sendError(res, 'Category not found', 404);
    return;
  }
  category.isActive = !category.isActive;
  await category.save();
  sendSuccess(res, category, `Category ${category.isActive ? 'activated' : 'deactivated'}`);
};
