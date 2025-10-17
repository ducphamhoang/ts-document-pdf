import 'reflect-metadata';
import app from './server';
import config from './infrastructure/config';
import logger from './infrastructure/logger/winston.logger';
import { cleanupService, storageService } from './shared/services';

const PORT = config.server.port;

const server = app.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Base URL: ${config.server.baseUrl}`);
  
  // Perform startup cleanup of any stale temporary directories
  try {
    await cleanupService.cleanupStaleTempDirectories();
    logger.info('Startup cleanup completed');
  } catch (error) {
    logger.error('Startup cleanup failed', { error });
  }
});

// Schedule cleanup to run every 15 minutes (900000 ms = 15 min)
const cleanupInterval = setInterval(async () => {
  try {
    await cleanupService.cleanup();
  } catch (error) {
    logger.error('Scheduled cleanup failed', { error });
    // Continue execution, don't crash the server on cleanup failure
  }
}, 900000); // 15 minutes

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  clearInterval(cleanupInterval);
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  clearInterval(cleanupInterval);
  server.close(() => {
    logger.info('Process terminated');
  });
});

export default server;