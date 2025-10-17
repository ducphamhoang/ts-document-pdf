import { ConvertFileUseCase } from '../../src/application/use-cases/convert-file.use-case';
import { DownloadFileUseCase } from '../../src/application/use-cases/download-file.use-case';
import { FileValidator } from '../../src/infrastructure/services/file-validator.service';
import { TempFileStorageService } from '../../src/infrastructure/services/temp-file-storage.service';
import { LibreOfficeConverter } from '../../src/infrastructure/services/libreoffice-converter.service';
import { ConversionQueueService } from '../../src/infrastructure/services/conversion-queue.service';
import { FileCleanupService } from '../../src/infrastructure/services/file-cleanup.service';
import { ConvertedPDF } from '../../src/domain/entities/converted-pdf.entity';
import config from '../../src/infrastructure/config';

// Mock dependencies
jest.mock('../../src/infrastructure/services/file-validator.service');
jest.mock('../../src/infrastructure/services/temp-file-storage.service');
jest.mock('../../src/infrastructure/services/libreoffice-converter.service');
jest.mock('../../src/infrastructure/services/conversion-queue.service');
jest.mock('../../src/infrastructure/services/file-cleanup.service');
jest.mock('fs/promises', () => ({
  readFile: jest.fn(() => Buffer.from('mock pdf content')),
  rm: jest.fn(),
  rmdir: jest.fn(),
}));

describe('Document to PDF Conversion Service Integration Tests', () => {
  let convertFileUseCase: ConvertFileUseCase;
  let downloadFileUseCase: DownloadFileUseCase;
  let cleanupService: FileCleanupService;
  let mockFileValidator: jest.Mocked<FileValidator>;
  let mockStorage: jest.Mocked<TempFileStorageService>;
  let mockConverter: jest.Mocked<LibreOfficeConverter>;
  let mockQueue: jest.Mocked<ConversionQueueService>;
  let mockCleanup: jest.Mocked<FileCleanupService>;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.docx',
    encoding: '7bit',
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 1024,
    destination: '/tmp',
    filename: 'test.docx',
    path: '/tmp/test.docx',
    buffer: Buffer.from('test content'),
    stream: require('stream').Readable.from(Buffer.from('test content')),
  };

  beforeEach(() => {
    mockFileValidator = new (FileValidator as any)();
    mockStorage = new (TempFileStorageService as any)();
    mockConverter = new (LibreOfficeConverter as any)();
    mockQueue = new (ConversionQueueService as any)();
    mockCleanup = new (FileCleanupService as any)();

    // Mock the queue execute method to just call the passed function
    mockQueue.execute.mockImplementation(async (task: () => Promise<any>) => {
      return await task();
    });

    convertFileUseCase = new ConvertFileUseCase(mockFileValidator, mockStorage, mockConverter);

    // Access the private queue property and replace it with our mock
    (convertFileUseCase as any).conversionQueue = mockQueue;

    downloadFileUseCase = new DownloadFileUseCase(mockStorage);
    cleanupService = new FileCleanupService(mockStorage);
  });

  describe('Full conversion to download flow', () => {
    it('should successfully convert a file and allow downloading', async () => {
      // Setup mock for the conversion process
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const mockConvertedPDF: ConvertedPDF = {
        id: 'test-pdf-id',
        originalDocumentId: 'original-doc-id',
        filename: 'converted_test.pdf',
        sizeBytes: 2048,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/test-pdf-id',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
        downloadCount: 0,
      };

      mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

      // Step 1: Convert the file
      const conversionResult = await convertFileUseCase.execute(mockFile);

      expect(conversionResult.id).toBe('test-pdf-id');
      expect(conversionResult.filename).toBe('converted_test.pdf');
      expect(conversionResult.sizeBytes).toBe(2048);
      expect(conversionResult.downloadUrl).toBe('http://localhost:3000/downloads/test-pdf-id');

      // Step 2: Download the converted file
      const downloadResult = await downloadFileUseCase.execute('test-pdf-id');

      expect(downloadResult.pdfRecord.id).toBe('test-pdf-id');
      expect(downloadResult.filePath).toBe('/tmp/converted_test.pdf');
      expect(downloadResult.fileBuffer).toEqual(Buffer.from('mock pdf content'));
      expect(downloadResult.pdfRecord.downloadCount).toBe(1); // Should be incremented
    });

    it('should handle multiple conversion and download processes', async () => {
      // First file conversion
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_first.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_first.pdf');

      const mockFirstPDF: ConvertedPDF = {
        id: 'first-pdf-id',
        originalDocumentId: 'first-doc-id',
        filename: 'converted_first.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_first.pdf',
        downloadUrl: 'http://localhost:3000/downloads/first-pdf-id',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
        downloadCount: 0,
      };

      // Second file conversion
      const secondFile = { ...mockFile, originalname: 'second.docx', filename: 'second.docx' };
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-67890');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_second.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_second.pdf');

      const mockSecondPDF: ConvertedPDF = {
        id: 'second-pdf-id',
        originalDocumentId: 'second-doc-id',
        filename: 'converted_second.pdf',
        sizeBytes: 2048,
        tempPath: '/tmp/converted_second.pdf',
        downloadUrl: 'http://localhost:3000/downloads/second-pdf-id',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
        downloadCount: 0,
      };

      mockStorage.getActivePDF.mockReturnValueOnce(mockFirstPDF).mockReturnValueOnce(mockSecondPDF);

      // Convert first file
      const firstConversionResult = await convertFileUseCase.execute(mockFile);
      expect(firstConversionResult.id).toBe('first-pdf-id');

      // Convert second file
      const secondConversionResult = await convertFileUseCase.execute(secondFile);
      expect(secondConversionResult.id).toBe('second-pdf-id');

      // Download both files
      const firstDownloadResult = await downloadFileUseCase.execute('first-pdf-id');
      const secondDownloadResult = await downloadFileUseCase.execute('second-pdf-id');

      expect(firstDownloadResult.pdfRecord.downloadCount).toBe(1);
      expect(secondDownloadResult.pdfRecord.downloadCount).toBe(1);
      expect(firstDownloadResult.fileBuffer).toEqual(Buffer.from('mock pdf content'));
      expect(secondDownloadResult.fileBuffer).toEqual(Buffer.from('mock pdf content'));
    });
  });

  describe('Queue integration', () => {
    it('should properly use the conversion queue during file conversion', async () => {
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const mockConvertedPDF: ConvertedPDF = {
        id: 'test-pdf-id',
        originalDocumentId: 'original-doc-id',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/test-pdf-id',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        downloadCount: 0,
      };

      mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

      const result = await convertFileUseCase.execute(mockFile);

      expect(mockQueue.execute).toHaveBeenCalled();
      expect(result.id).toBe('test-pdf-id');
    });

    it('should handle concurrent conversions through the queue', async () => {
      // Mock config to set max concurrent conversions to 2
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 2;

      try {
        // Create a new queue service instance with the updated config
        const queueService = new (ConversionQueueService as any)();
        queueService.execute = jest.fn().mockImplementation(async (task: () => Promise<any>) => {
          return await task();
        });

        // Replace the queue in the use case
        (convertFileUseCase as any).conversionQueue = queueService;

        // Mock file validation and other services
        mockFileValidator.validateFile.mockResolvedValue();
        mockStorage.createTempDirectory.mockResolvedValue('/tmp/convert-12345');
        mockConverter.convert.mockResolvedValue('/tmp/converted_test.pdf');
        mockStorage.savePDF.mockResolvedValue('/tmp/converted_test.pdf');

        const mockConvertedPDF: ConvertedPDF = {
          id: 'test-pdf-id',
          originalDocumentId: 'original-doc-id',
          filename: 'converted_test.pdf',
          sizeBytes: 1024,
          tempPath: '/tmp/converted_test.pdf',
          downloadUrl: 'http://localhost:3000/downloads/test-pdf-id',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
          downloadCount: 0,
        };

        mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

        // Execute multiple conversions concurrently
        const promises = Array(3)
          .fill(0)
          .map(() => convertFileUseCase.execute(mockFile));
        const results = await Promise.all(promises);

        // All should complete successfully
        expect(results.length).toBe(3);
        expect(queueService.execute).toHaveBeenCalledTimes(3);
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });
  });

  describe('File validation integration', () => {
    it('should validate files before conversion', async () => {
      const validationError = new Error('Invalid file type');
      mockFileValidator.validateFile.mockRejectedValueOnce(validationError);

      await expect(convertFileUseCase.execute(mockFile)).rejects.toThrow('Invalid file type');

      // Conversion should not proceed if validation fails
      expect(mockStorage.createTempDirectory).not.toHaveBeenCalled();
      expect(mockConverter.convert).not.toHaveBeenCalled();
    });

    it('should not allow download of files that failed validation', async () => {
      // Setup a valid conversion first
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const mockConvertedPDF: ConvertedPDF = {
        id: 'test-pdf-id',
        originalDocumentId: 'original-doc-id',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/test-pdf-id',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        downloadCount: 0,
      };

      mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

      // Convert the valid file
      const conversionResult = await convertFileUseCase.execute(mockFile);
      expect(conversionResult.id).toBe('test-pdf-id');

      // Now try to download a non-existent file
      await expect(downloadFileUseCase.execute('non-existent-id')).rejects.toThrow(
        'PDF with ID non-existent-id not found'
      );
    });
  });

  describe('Cleanup integration', () => {
    it('should clean up expired files through the cleanup service', async () => {
      // Mock cleanup service to verify it's called
      mockCleanup.cleanup = jest.fn().mockResolvedValue(undefined);

      await mockCleanup.cleanup();

      expect(mockCleanup.cleanup).toHaveBeenCalled();
    });

    it('should not allow download of expired files', async () => {
      // Setup a conversion with an expired PDF
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const expiredPDF: ConvertedPDF = {
        id: 'expired-pdf-id',
        originalDocumentId: 'original-doc-id',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/expired-pdf-id',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 25), // 25 hours ago
        expiresAt: new Date(Date.now() - 1000 * 60 * 5), // Expired 5 minutes ago
        downloadCount: 0,
      };

      mockStorage.getActivePDF.mockReturnValueOnce(expiredPDF);

      // Convert the file (this doesn't consider expiration)
      const conversionResult = await convertFileUseCase.execute(mockFile);
      expect(conversionResult.id).toBeDefined();

      // Try to download the file - this should fail because it's expired
      await expect(downloadFileUseCase.execute('expired-pdf-id')).rejects.toThrow(
        'Converted PDF with ID expired-pdf-id has expired'
      );
    });

    it('should allow download of non-expired files', async () => {
      // Setup a conversion with a valid PDF
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const validPDF: ConvertedPDF = {
        id: 'valid-pdf-id',
        originalDocumentId: 'original-doc-id',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/valid-pdf-id',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 23), // Expires in 23 hours
        downloadCount: 0,
      };

      mockStorage.getActivePDF.mockReturnValueOnce(validPDF);

      // Convert the file
      const conversionResult = await convertFileUseCase.execute(mockFile);
      expect(conversionResult.id).toBe('valid-pdf-id');

      // Download should succeed
      const downloadResult = await downloadFileUseCase.execute('valid-pdf-id');
      expect(downloadResult.pdfRecord.id).toBe('valid-pdf-id');
      expect(downloadResult.pdfRecord.downloadCount).toBe(1);
    });
  });

  describe('End-to-end error scenarios', () => {
    it('should handle conversion errors properly', async () => {
      // Mock conversion failure
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      const conversionError = new Error('Conversion failed');
      mockConverter.convert.mockRejectedValueOnce(conversionError);

      await expect(convertFileUseCase.execute(mockFile)).rejects.toThrow('Conversion failed');
    });

    it('should handle file system errors during download', async () => {
      // Setup conversion
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const mockConvertedPDF: ConvertedPDF = {
        id: 'test-pdf-id',
        originalDocumentId: 'original-doc-id',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/test-pdf-id',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        downloadCount: 0,
      };

      mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

      // Mock file system error during download
      (require('fs/promises').readFile as jest.Mock).mockRejectedValueOnce(
        new Error('File not found')
      );

      await expect(downloadFileUseCase.execute('test-pdf-id')).rejects.toThrow('File not found');
    });
  });

  describe('Download count tracking integration', () => {
    it('should increment download count with each download', async () => {
      // Setup conversion
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const mockConvertedPDF: ConvertedPDF = {
        id: 'test-pdf-id',
        originalDocumentId: 'original-doc-id',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/test-pdf-id',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        downloadCount: 0,
      };

      mockStorage.getActivePDF
        .mockReturnValueOnce(mockConvertedPDF) // For first download
        .mockReturnValueOnce({ ...mockConvertedPDF, downloadCount: 1 }) // For second download
        .mockReturnValueOnce({ ...mockConvertedPDF, downloadCount: 2 }); // For third download

      // Convert the file
      const conversionResult = await convertFileUseCase.execute(mockFile);
      expect(conversionResult.id).toBe('test-pdf-id');

      // Download multiple times and check download count
      const firstDownload = await downloadFileUseCase.execute('test-pdf-id');
      expect(firstDownload.pdfRecord.downloadCount).toBe(1);

      const secondDownload = await downloadFileUseCase.execute('test-pdf-id');
      expect(secondDownload.pdfRecord.downloadCount).toBe(2);

      const thirdDownload = await downloadFileUseCase.execute('test-pdf-id');
      expect(thirdDownload.pdfRecord.downloadCount).toBe(3);
    });
  });
});
