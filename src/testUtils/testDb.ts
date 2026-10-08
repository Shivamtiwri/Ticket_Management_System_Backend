import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

export const buildTestUri = (): string => {
  const base = process.env.MONGODB_URI || 'mongodb://localhost:27017/ticket_management_test';
  const schemeIdx = base.indexOf('://');
  if (schemeIdx === -1) {
    return 'mongodb://localhost:27017/ticket_management_test';
  }
  const authorityStart = schemeIdx + 3;
  const pathStart = base.indexOf('/', authorityStart);
  const queryIdx = base.indexOf('?');
  const suffix = queryIdx === -1 ? '' : base.slice(queryIdx);

  if (pathStart === -1) {
    return queryIdx === -1
      ? `${base}/ticket_management_test`
      : `${base.slice(0, queryIdx)}/ticket_management_test${suffix}`;
  }
  return `${base.slice(0, pathStart + 1)}ticket_management_test${suffix}`;
};

export const TEST_URI = buildTestUri();

export const connectTestDb = async (timeoutMs = 5000): Promise<boolean> => {
  try {
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: timeoutMs });
    return true;
  } catch (err) {
    console.warn('MongoDB unavailable - DB-backed tests will be skipped:', (err as Error).message);
    return false;
  }
};
