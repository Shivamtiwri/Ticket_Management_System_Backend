
import { Response } from 'express';
import { Category } from '../models/Category';
import { Ticket } from '../models/Ticket';
import { ActivityLog } from '../models/ActivityLog';
import { AuthRequest, ActivityAction } from '../types';
import { sendSuccess, sendCreated, sendError } from '../utils/apiResponse';
import { escapeRegex } from '../utils/queryUtils';

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

  const escapedName = escapeRegex(name.trim());
  const existing = await Category.findOne({ name: { $regex: `^${escapedName}$`, $options: 'i' } });
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
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (isActive !== undefined) updates.isActive = isActive;

  const category = await Category.findByIdAndUpdate(
    req.params.id,
    updates,
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
  const ticketCount = await Ticket.countDocuments({ category: req.params.id });
  if (ticketCount > 0) {
    sendError(
      res,
      `Cannot delete category: it is used by ${ticketCount} ticket${ticketCount === 1 ? '' : 's'}. Deactivate it instead`,
      409
    );
    return;
  }

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
