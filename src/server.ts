import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDatabase } from './config/database';
import { initSocket } from './socket';
import { logger } from './utils/logger';
import { validateCloudinaryConfig } from './middleware/upload';

const PORT = parseInt(process.env.PORT || '5000');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

const startServer = async (): Promise<void> => {
  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET is not set. Please configure your .env file');
    process.exit(1);
  }

  validateCloudinaryConfig();
  await connectDatabase();

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });

  initSocket(server);

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      const { disconnectDatabase } = await import('./config/database');
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
