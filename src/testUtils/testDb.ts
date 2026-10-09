import mongoose from 'mongoose';

export const buildTestUri = (): string => {
  const uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    throw new Error(
      'TEST_MONGODB_URI is required for backend integration tests. Set it to a dedicated database whose name ends in "_test".'
    );
  }

  let databaseName: string;
  try {
    databaseName = new URL(uri).pathname.replace(/^\/+/, '');
  } catch {
    throw new Error('TEST_MONGODB_URI must be a valid MongoDB connection URI.');
  }

  if (!/(?:^|[-_])test$/i.test(databaseName)) {
    throw new Error(
      'Refusing to connect integration tests to a database not named with the "_test" or "-test" suffix.'
    );
  }

  return uri;
};

export const TEST_URI = process.env.TEST_MONGODB_URI ? buildTestUri() : undefined;

export const connectTestDb = async (timeoutMs = 5000): Promise<void> => {
  if (!TEST_URI) {
    throw new Error('TEST_MONGODB_URI is required for backend integration tests.');
  }
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: timeoutMs });
};

export const disconnectTestDb = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};
