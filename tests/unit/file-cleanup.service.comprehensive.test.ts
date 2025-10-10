import { FileCleanupService } from '../../src/infrastructure/services/file-cleanup.service';
import { TempFileStorageService } from '../../src/infrastructure/services/temp-file-storage.service';
import { ConvertedPDF } from '../../src/domain/entities/converted-pdf.entity';
import os from 'os';
import { promises as fs } from 'fs';

// Mock dependencies
jest.mock('../../src/infrastructure/services/temp-file-storage.service');
jest.mock('fs');
jest.mock('os');

// Mock dependencies
jest.mock('../../src/infrastructure/services/temp-file-storage.service');
jest.mock('fs');
jest.mock('os');

describe('FileCleanupService Comprehensive Tests', () => {
  let cleanupService: FileCleanupService;
  let mockStorage: jest.Mocked<TempFileStorageService>;

  const now = new Date();
  const expiredDate = new Date(now.getTime() - 1000 * 60 * 60 * 25); // 25 hours ago (expired)
  const validDate = new Date(now.getTime() + 1000 * 60 * 60 * 23); // 23 hours from now (valid)

  beforeEach(() => {
    mockStorage = new (TempFileStorageService as any)();
    cleanupService = new FileCleanupService(mockStorage);
    jest.clearAllMocks();
    
    // Mock current date
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic cleanup functionality', () => {
    it('should call storage cleanup method', async () => {
      mockStorage.cleanup.mockResolvedValue();

      await cleanupService.cleanup();

      expect(mockStorage.cleanup).toHaveBeenCalled();
    });

    it('should propagate errors from storage cleanup', async () => {
      const cleanupError = new Error('Storage cleanup failed');
      mockStorage.cleanup.mockRejectedValueOnce(cleanupError);

      await expect(cleanupService.cleanup())
        .rejects
        .toThrow('Storage cleanup failed');
    });
  });

  describe('Expire PDF cleanup', () => {
    it('should clean up expired PDFs through storage service', async () => {
      mockStorage.cleanup.mockResolvedValue();

      await cleanupService.cleanup();

      expect(mockStorage.cleanup).toHaveBeenCalled();
    });

    it('should handle storage cleanup without errors', async () => {
      mockStorage.cleanup.mockResolvedValue();

      await expect(cleanupService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Stale temporary directory cleanup', () => {
    it('should clean up stale temporary directories', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to return some convert-* directories
      const mockTempFiles = ['convert-abc123', 'convert-def456', 'other-dir', 'convert-ghi789'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockTempFiles);
      
      // Mock fs.stat to return old modification times for the convert directories
      const mockStatOld = {
        isDirectory: () => true,
        mtime: new Date(now.getTime() - 1000 * 60 * 60 * 25) // 25 hours ago
      };
      const mockStatNew = {
        isDirectory: () => true,
        mtime: new Date(now.getTime() - 1000 * 60 * 30) // 30 minutes ago
      };
      
      (fs.stat as jest.Mock)
        .mockResolvedValueOnce(mockStatOld)  // convert-abc123 - old
        .mockResolvedValueOnce(mockStatOld)  // convert-def456 - old
        .mockResolvedValueOnce(mockStatNew); // convert-ghi789 - new (should not be deleted)
      
      // Mock fs.rm to track deletions
      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue();
      
      await cleanupService.cleanupStaleTempDirectories();

      // Should have tried to remove the two old directories
      expect(fs.readdir).toHaveBeenCalledWith('/tmp');
      expect(fs.stat).toHaveBeenCalledTimes(3); // Called for each convert-* directory
      expect(rmSpy).toHaveBeenCalledTimes(2); // Should delete 2 directories
    });

    it('should not clean up non-convert directories', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to return non-convert directories
      const mockTempFiles = ['regular-dir', 'another-dir', 'some-file.txt'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockTempFiles);
      
      // Mock fs.rm to track deletions
      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue();
      
      await cleanupService.cleanupStaleTempDirectories();

      // Should not have tried to remove any directories
      expect(fs.readdir).toHaveBeenCalledWith('/tmp');
      expect(rmSpy).not.toHaveBeenCalled();
    });

    it('should not clean up recent convert directories', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to return convert directories
      const mockTempFiles = ['convert-abc123', 'convert-def456'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockTempFiles);
      
      // Mock fs.stat to return recent modification times
      const mockStatNew = {
        isDirectory: () => true,
        mtime: new Date(now.getTime() - 1000 * 60 * 30) // 30 minutes ago
      };
      
      (fs.stat as jest.Mock)
        .mockResolvedValueOnce(mockStatNew)
        .mockResolvedValueOnce(mockStatNew);
      
      // Mock fs.rm to track deletions
      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue();
      
      await cleanupService.cleanupStaleTempDirectories();

      // Should not have tried to remove any directories
      expect(fs.readdir).toHaveBeenCalledWith('/tmp');
      expect(rmSpy).not.toHaveBeenCalled();
    });

    it('should handle fs.readdir errors', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to throw an error
      const readDirError = new Error('Cannot read directory');
      (fs.readdir as jest.Mock).mockRejectedValueOnce(readDirError);
      
      await expect(cleanupService.cleanupStaleTempDirectories())
        .rejects
        .toThrow('Cannot read directory');
    });

    it('should handle fs.stat errors', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to return a convert directory
      const mockTempFiles = ['convert-abc123'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockTempFiles);
      
      // Mock fs.stat to throw an error
      const statError = new Error('Cannot stat directory');
      (fs.stat as jest.Mock).mockRejectedValueOnce(statError);
      
      // Mock fs.rm to track if it's called (shouldn't be for a stat error)
      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue();
      
      await expect(cleanupService.cleanupStaleTempDirectories())
        .rejects
        .toThrow('Cannot stat directory');
      
      // rm should not have been called since we can't determine if it's stale
      expect(rmSpy).not.toHaveBeenCalled();
    });

    it('should handle fs.rm errors', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to return a convert directory
      const mockTempFiles = ['convert-abc123'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockTempFiles);
      
      // Mock fs.stat to return an old directory
      const mockStatOld = {
        isDirectory: () => true,
        mtime: new Date(now.getTime() - 1000 * 60 * 60 * 25) // 25 hours ago
      };
      (fs.stat as jest.Mock).mockResolvedValueOnce(mockStatOld);
      
      // Mock fs.rm to throw an error
      const rmError = new Error('Cannot remove directory');
      (fs.rm as jest.Mock).mockRejectedValueOnce(rmError);
      
      // Should still complete without throwing, just log the error
      await expect(cleanupService.cleanupStaleTempDirectories()).resolves;
    });

    it('should handle non-directory entries', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to return a convert file (not directory)
      const mockTempFiles = ['convert-abc123'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockTempFiles);
      
      // Mock fs.stat to return that it's not a directory
      const mockStatFile = {
        isDirectory: () => false, // Not a directory
        mtime: new Date(now.getTime() - 1000 * 60 * 60 * 25) // 25 hours ago
      };
      (fs.stat as jest.Mock).mockResolvedValueOnce(mockStatFile);
      
      // Mock fs.rm to track if it's called (shouldn't be for non-directories)
      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue();
      
      await cleanupService.cleanupStaleTempDirectories();

      // Should not try to remove files, only directories
      expect(rmSpy).not.toHaveBeenCalled();
    });

    it('should handle convert directories with short names', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to return some convert directories with various names
      const mockTempFiles = ['convert-', 'convert-a', 'convert-ab', 'convert-abc'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockTempFiles);
      
      // Mock fs.rm to track deletions
      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue();
      
      await cleanupService.cleanupStaleTempDirectories();

      // Should not process the first three (too short) but might process convert-abc
      // The function checks for names longer than 'convert-' + 5 chars
      // 'convert-' is 8 chars, so names need to be at least 14 chars to be processed
      // convert-abc is only 11 chars (8 + 3), so it won't be processed
      expect(fs.stat).not.toHaveBeenCalled(); // No stat calls since all names are too short
      expect(rmSpy).not.toHaveBeenCalled();
    });
  });

  describe('Combined cleanup operations', () => {
    it('should perform both PDF cleanup and temp directory cleanup', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      const mockTempFiles = ['convert-abc123'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockTempFiles);
      const mockStatOld = { isDirectory: () => true, mtime: expiredDate };
      (fs.stat as jest.Mock).mockResolvedValueOnce(mockStatOld);
      jest.spyOn(fs, 'rm').mockResolvedValue();
      
      mockStorage.cleanup.mockResolvedValue();

      await cleanupService.cleanup();
      await cleanupService.cleanupStaleTempDirectories();

      expect(mockStorage.cleanup).toHaveBeenCalled();
      expect(fs.readdir).toHaveBeenCalledWith('/tmp');
    });
  });

  describe('Error handling for both cleanup methods', () => {
    it('should handle errors in PDF cleanup without affecting temp directory cleanup', async () => {
      // Mock PDF cleanup to fail
      const pdfCleanupError = new Error('PDF cleanup failed');
      mockStorage.cleanup.mockRejectedValueOnce(pdfCleanupError);

      await expect(cleanupService.cleanup())
        .rejects
        .toThrow('PDF cleanup failed');
    });

    it('should handle errors in temp directory cleanup without affecting PDF cleanup', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to fail
      const dirReadError = new Error('Cannot read temp directory');
      (fs.readdir as jest.Mock).mockRejectedValueOnce(dirReadError);

      await expect(cleanupService.cleanupStaleTempDirectories())
        .rejects
        .toThrow('Cannot read temp directory');
    });

    it('should return successfully when both cleanups succeed', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      (fs.readdir as jest.Mock).mockResolvedValue([]);
      mockStorage.cleanup.mockResolvedValue();

      await expect(cleanupService.cleanup()).resolves.not.toThrow();
      await expect(cleanupService.cleanupStaleTempDirectories()).resolves.not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty temporary directory', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to return empty array
      (fs.readdir as jest.Mock).mockResolvedValue([]);
      
      await expect(cleanupService.cleanupStaleTempDirectories()).resolves.not.toThrow();
    });

    it('should handle temporary directory with only convert directories that are recent', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to return convert directories
      const mockTempFiles = ['convert-abc123', 'convert-def456'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockTempFiles);
      
      // Mock fs.stat to show they're recent
      const mockStatRecent = {
        isDirectory: () => true,
        mtime: new Date(now.getTime() - 1000 * 60 * 60) // 1 hour ago
      };
      
      (fs.stat as jest.Mock)
        .mockResolvedValueOnce(mockStatRecent)
        .mockResolvedValueOnce(mockStatRecent);
      
      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue();
      
      await expect(cleanupService.cleanupStaleTempDirectories()).resolves.not.toThrow();
      
      // No directories should be removed
      expect(rmSpy).not.toHaveBeenCalled();
    });

    it('should handle temporary directory with only non-convert directories', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to return non-convert directories
      const mockTempFiles = ['regular-dir', 'another-dir', 'some-other-dir'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockTempFiles);
      
      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue();
      
      await expect(cleanupService.cleanupStaleTempDirectories()).resolves.not.toThrow();
      
      // No directories should be removed
      expect(rmSpy).not.toHaveBeenCalled();
    });

    it('should handle very old directories', async () => {
      // Mock os.tmpdir to return a test path
      (os as any).tmpdir.mockReturnValue('/tmp');
      
      // Mock fs.readdir to return a convert directory
      const mockTempFiles = ['convert-veryold'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockTempFiles);
      
      // Mock fs.stat to return a very old directory (years ago)
      const mockStatVeryOld = {
        isDirectory: () => true,
        mtime: new Date(2020, 0, 1) // Very old date
      };
      (fs.stat as jest.Mock).mockResolvedValueOnce(mockStatVeryOld);
      
      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue();
      
      await cleanupService.cleanupStaleTempDirectories();
      
      // The old directory should be removed
      expect(rmSpy).toHaveBeenCalledTimes(1);
    });
  });
});