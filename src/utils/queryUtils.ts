import { FilterQuery } from 'mongoose';
import { ITicket } from '../types';

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildSearchRegex = (value: string): RegExp => new RegExp(escapeRegex(value.trim()), 'i');

export const isObjectIdString = (value: string): boolean => /^[0-9a-fA-F]{24}$/.test(value);

export const ticketIdFilter = (id: string): FilterQuery<ITicket> => {
  const or: FilterQuery<ITicket>[] = [{ ticketId: id } as FilterQuery<ITicket>];
  if (isObjectIdString(id)) {
    or.push({ _id: id } as FilterQuery<ITicket>);
  }
  return { $or: or };
};
