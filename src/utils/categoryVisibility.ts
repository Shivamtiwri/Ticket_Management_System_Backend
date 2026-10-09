import { Types } from 'mongoose';
import { Category } from '../models/Category';
import { UserRole } from '../types';

export const getVisibleCategoryIds = async (role: UserRole): Promise<Types.ObjectId[] | undefined> => {
  if (role === UserRole.ADMIN) return undefined;
  return Category.distinct('_id', { isActive: true });
};

export const canAccessCategory = async (
  categoryId: Types.ObjectId | string,
  role: UserRole
): Promise<boolean> => {
  if (role === UserRole.ADMIN) return true;
  return Boolean(await Category.exists({ _id: categoryId, isActive: true }));
};
