import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDatabase } from './config/database';
import { initSocket } from './socket';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '5000');

const startServer = async (): Promise<void> => {
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
