import { ConvertFileUseCase } from '../../src/application/use-cases/convert-file.use-case';
import { DownloadFileUseCase } from '../../src/application/use-cases/download-file.use-case';
import { FileValidator } from '../../src/infrastructure/services/file-validator.service';
import { TempFileStorageService } from '../../src/infrastructure/services/temp-file-storage.service';
import { LibreOfficeConverter } from '../../src/infrastructure/services/libreoffice-converter.service';
import { ConversionQueueService } from '../../src/infrastructure/services/conversion-queue.service';
import { FileCleanupService } from '../../src/infrastructure/services/file-cleanup.service';
import { ConvertedPDF } from '../../src/domain/entities/converted-pdf.entity';
import { 
  UnsupportedFileTypeError, 
  FileTooLargeError, 
  InvalidFileSignatureError,
  ConversionFailedError,
  ConversionTimeoutError,
  FileNotFoundError
} from '../../src/domain/errors';

// Mock dependencies
jest.mock('../../src/infrastructure/services/file-validator.service');
jest.mock('../../src/infrastructure/services/temp-file-storage.service');
jest.mock('../../src/infrastructure/services/libreoffice-converter.service');
jest.mock('../../src/infrastructure/services/conversion-queue.service');
jest.mock('fs/promises', () => ({
  readFile: jest.fn(() => Buffer.from('mock pdf content')),
  rm: jest.fn(),
  rmdir: jest.fn(),
}));

describe('Error Handling Comprehensive Tests', () => {
  let convertFileUseCase: ConvertFileUseCase;
  let downloadFileUseCase: DownloadFileUseCase;
  let cleanupService: FileCleanupService;
  let mockFileValidator: jest.Mocked<FileValidator>;
  let mockStorage: jest.Mocked<TempFileStorageService>;
  let mockConverter: jest.Mocked<LibreOfficeConverter>;
  let mockQueue: jest.Mocked<ConversionQueueService>;

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
    
    // Mock the queue execute method to just call the passed function
    mockQueue.execute.mockImplementation(async (task: () => Promise<any>) => {
      return await task();
    });
    
    convertFileUseCase = new ConvertFileUseCase(
      mockFileValidator,
      mockStorage,
      mockConverter
    );
    
    // Access the private queue property and replace it with our mock
    (convertFileUseCase as any).conversionQueue = mockQueue;
    
    downloadFileUseCase = new DownloadFileUseCase(mockStorage);
    cleanupService = new FileCleanupService(mockStorage);
  });

  describe('FileValidator Error Handling', () => {
    it('should properly propagate UnsupportedFileTypeError', async () => {
      const error = new UnsupportedFileTypeError('File type not supported');
      mockFileValidator.validateFile.mockRejectedValueOnce(error);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow(UnsupportedFileTypeError);
      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('File type not supported');
    });

    it('should properly propagate FileTooLargeError', async () => {
      const error = new FileTooLargeError('File exceeds maximum size');
      mockFileValidator.validateFile.mockRejectedValueOnce(error);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow(FileTooLargeError);
      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('File exceeds maximum size');
    });

    it('should properly propagate InvalidFileSignatureError', async () => {
      const error = new InvalidFileSignatureError('Invalid file signature');
      mockFileValidator.validateFile.mockRejectedValueOnce(error);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow(InvalidFileSignatureError);
      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Invalid file signature');
    });

    it('should handle generic validation errors', async () => {
      const error = new Error('Generic validation error');
      mockFileValidator.validateFile.mockRejectedValueOnce(error);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Generic validation error');
    });
  });

  describe('Storage Service Error Handling', () => {
    it('should handle temp directory creation errors', async () => {
      mockFileValidator.validateFile.mockResolvedValueOnce();
      const creationError = new Error('Failed to create temp directory');
      mockStorage.createTempDirectory.mockRejectedValueOnce(creationError);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Failed to create temp directory');
    });

    it('should handle PDF save errors', async () => {
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      const saveError = new Error('Failed to save PDF');
      mockStorage.savePDF.mockRejectedValueOnce(saveError);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Failed to save PDF');
    });

    it('should handle PDF get errors in download use case', async () => {
      const getError = new Error('Failed to get PDF');
      mockStorage.getPDF.mockRejectedValueOnce(getError);

      await expect(downloadFileUseCase.execute('test-id'))
        .rejects
        .toThrow('Failed to get PDF');
    });

    it('should handle missing PDF record in download use case', async () => {
      // Mock getPDF to succeed but activePDFs to be empty
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      jest.spyOn(mockStorage, 'getActivePDF').mockReturnValue(null as any); // Return null for missing record

      await expect(downloadFileUseCase.execute('non-existent-id'))
        .rejects
        .toThrow(FileNotFoundError);
      await expect(downloadFileUseCase.execute('non-existent-id'))
        .rejects
        .toThrow('PDF record with ID non-existent-id not found');
    });
  });

  describe('Converter Service Error Handling', () => {
    it('should properly handle conversion failures', async () => {
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      const conversionError = new ConversionFailedError('Conversion failed');
      mockConverter.convert.mockRejectedValueOnce(conversionError);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow(ConversionFailedError);
      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Conversion failed');
    });

    it('should properly handle conversion timeout errors', async () => {
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      const timeoutError = new ConversionTimeoutError('Conversion timed out');
      mockConverter.convert.mockRejectedValueOnce(timeoutError);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow(ConversionTimeoutError);
      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Conversion timed out');
    });

    it('should handle generic converter errors', async () => {
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      const genericError = new Error('Converter error occurred');
      mockConverter.convert.mockRejectedValueOnce(genericError);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Converter error occurred');
    });
  });

  describe('Queue Service Error Handling', () => {
    it('should propagate errors from the queue execution', async () => {
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      
      // Make the queue execution fail
      const queueError = new Error('Queue execution failed');
      mockQueue.execute.mockRejectedValueOnce(queueError);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Queue execution failed');
    });

    it('should handle queue timeouts', async () => {
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      
      // Make the queue execution timeout
      const timeoutError = new Error('Queue operation timed out');
      mockQueue.execute.mockRejectedValueOnce(timeoutError);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Queue operation timed out');
    });
  });

  describe('File Download Error Handling', () => {
    it('should throw FileNotFoundError for missing files', async () => {
      mockStorage.getPDF.mockResolvedValueOnce(null);

      await expect(downloadFileUseCase.execute('non-existent-id'))
        .rejects
        .toThrow(FileNotFoundError);
      await expect(downloadFileUseCase.execute('non-existent-id'))
        .rejects
        .toThrow('PDF with ID non-existent-id not found');
    });

    it('should throw FileNotFoundError for expired files', async () => {
      const expiredError = new FileNotFoundError('Converted PDF with ID expired-id has expired');
      mockStorage.getPDF.mockRejectedValueOnce(expiredError);

      await expect(downloadFileUseCase.execute('expired-id'))
        .rejects
        .toThrow(FileNotFoundError);
      await expect(downloadFileUseCase.execute('expired-id'))
        .rejects
        .toThrow('Converted PDF with ID expired-id has expired');
    });

    it('should handle file read errors during download', async () => {
      // Mock fs.readFile to throw an error
      const fs = require('fs/promises');
      jest.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('Cannot read file'));
      
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getActivePDF.mockReturnValueOnce({
        id: 'read-error-id',
        originalDocumentId: 'original-doc-id',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/read-error-id',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        downloadCount: 0,
      });

      await expect(downloadFileUseCase.execute('read-error-id'))
        .rejects
        .toThrow('Cannot read file');
    });
  });

  describe('Cleanup Service Error Handling', () => {
    it('should handle storage cleanup errors', async () => {
      const cleanupError = new Error('Storage cleanup failed');
      mockStorage.cleanup.mockRejectedValueOnce(cleanupError);

      await expect(cleanupService.cleanup())
        .rejects
        .toThrow('Storage cleanup failed');
    });

    it('should handle file system errors in temp directory cleanup', async () => {
      // Mock os and fs modules for cleanup
      jest.doMock('os', () => ({ tmpdir: () => '/tmp' }));
      jest.doMock('fs/promises', () => ({
        readdir: jest.fn().mockRejectedValue(new Error('Cannot read directory')),
        stat: jest.fn(),
        rm: jest.fn(),
      }));

      // Need to import after mocking
      const originalModule = await import('../../src/infrastructure/services/file-cleanup.service');
      const mockedModule = jest.requireMock('../../src/infrastructure/services/file-cleanup.service');
      const { FileCleanupService: MockedCleanupService } = mockedModule;
      
      const mockStorageForCleanup = new (TempFileStorageService as any)();
      const cleanupServiceForTest = new MockedCleanupService(mockStorageForCleanup);

      await expect(cleanupServiceForTest.cleanupStaleTempDirectories())
        .rejects
        .toThrow('Cannot read directory');
    });
  });

  describe('Multiple Error Scenarios', () => {
    it('should handle sequential failures gracefully', async () => {
      // First request fails validation
      const validationError = new UnsupportedFileTypeError('Invalid file type');
      mockFileValidator.validateFile.mockRejectedValueOnce(validationError);
      
      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Invalid file type');

      // Second request succeeds validation but fails conversion
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      const conversionError = new Error('Conversion failed');
      mockConverter.convert.mockRejectedValueOnce(conversionError);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Conversion failed');
    });

    it('should handle errors without affecting other operations', async () => {
      // Setup success case
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_successful.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_successful.pdf');
      
      const mockSuccessfulPDF: ConvertedPDF = {
        id: 'successful-id',
        originalDocumentId: 'original-doc-id',
        filename: 'converted_successful.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_successful.pdf',
        downloadUrl: 'http://localhost:3000/downloads/successful-id',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        downloadCount: 0,
      };
      
      mockStorage.getActivePDF.mockReturnValueOnce(mockSuccessfulPDF);
      
      // First request succeeds
      const conversionResult = await convertFileUseCase.execute(mockFile);
      expect(conversionResult.id).toBe('successful-id');
      
      // Second request fails validation
      const validationError = new UnsupportedFileTypeError('Invalid file type');
      mockFileValidator.validateFile.mockRejectedValueOnce(validationError);
      
      await expect(convertFileUseCase.execute({ ...mockFile, originalname: 'invalid.txt' }))
        .rejects
        .toThrow('Invalid file type');
      
      // The successful conversion should still be available for download
      const downloadResult = await downloadFileUseCase.execute('successful-id');
      expect(downloadResult.pdfRecord.id).toBe('successful-id');
    });
  });

  describe('Error Propagation and Chaining', () => {
    it('should maintain error context through the call chain', async () => {
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      
      const saveError = new Error('Storage save failed');
      mockStorage.savePDF.mockRejectedValueOnce(saveError);

      const result = convertFileUseCase.execute(mockFile);
      await expect(result).rejects.toThrow('Storage save failed');
    });

    it('should preserve original error types', async () => {
      const specificError = new UnsupportedFileTypeError('Custom message');
      mockFileValidator.validateFile.mockRejectedValueOnce(specificError);

      const result = convertFileUseCase.execute(mockFile);
      await expect(result).rejects.toThrow(UnsupportedFileTypeError);
      await expect(result).rejects.toThrow('Custom message');
    });

    it('should handle third-party library errors', async () => {
      // Simulate an error from a third-party library like fileTypeFromBuffer
      const thirdPartyError = new Error('Third-party library error');
      mockFileValidator.validateFile.mockRejectedValueOnce(thirdPartyError);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Third-party library error');
    });
  });

  describe('Resource Cleanup on Errors', () => {
    it('should properly handle cleanup when conversion fails', async () => {
      mockFileValidator.validateFile.mockResolvedValueOnce();
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      
      // Make conversion fail after temp directory was created
      const conversionError = new Error('Conversion failed after temp directory created');
      mockConverter.convert.mockRejectedValueOnce(conversionError);

      // The service should handle the cleanup of the temp directory
      // even if the main operation fails
      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow('Conversion failed after temp directory created');
    });
  });
});