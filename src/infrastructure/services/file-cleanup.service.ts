import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { IStorage } from '../../application/interfaces/storage.interface';
import logger from '../logger/winston.logger';

export interface ICleanupService {
  cleanup(): Promise<void>;
  cleanupStaleTempDirectories(): Promise<void>;
}

export class FileCleanupService implements ICleanupService {
  constructor(private storage: IStorage) {}

  async cleanup(): Promise<void> {
    logger.info('Starting scheduled cleanup of expired files');

    try {
      // Clean up expired files through the storage service
      await this.storage.cleanup();
      logger.info('Completed scheduled cleanup of expired files');
    } catch (error) {
      logger.error('Error during scheduled cleanup', { error });
      throw error;
    }
  }

  async cleanupStaleTempDirectories(): Promise<void> {
    logger.info('Starting cleanup of stale temporary directories');

    try {
      // Find directories that match the pattern /tmp/convert-*
      const tempDir = os.tmpdir();
      const files = await fs.readdir(tempDir);
      
      const staleDirs = files.filter(file => {
        return file.startsWith('convert-') && 
               file.length > 'convert-'.length + 5; // Make sure it's a proper convert-XXXXX directory
      });

      for (const dirName of staleDirs) {
        const dirPath = path.join(tempDir, dirName);
        
        try {
          const stats = await fs.stat(dirPath);
          
          if (stats.isDirectory()) {
            // For now we'll just remove directories that are older than 1 day
            // In a real implementation, you might want a more sophisticated check
            const now = new Date();
            const dirTime = stats.mtime;
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
            
            if (dirTime < oneDayAgo) {
              await fs.rm(dirPath, { recursive: true, force: true });
              logger.info(`Removed stale temporary directory: ${dirPath}`);
            }
          }
        } catch (error) {
          logger.error(`Error checking or removing stale directory: ${dirPath}`, { error });
        }
      }

      logger.info(`Completed cleanup of stale temporary directories. Processed ${staleDirs.length} directories.`);
    } catch (error) {
      logger.error('Error during cleanup of stale temporary directories', { error });
      throw error;
    }
  }
}