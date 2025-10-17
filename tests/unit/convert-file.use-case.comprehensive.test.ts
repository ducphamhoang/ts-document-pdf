import { ConvertFileUseCase } from '../../src/application/use-cases/convert-file.use-case';
import { FileValidator } from '../../src/infrastructure/services/file-validator.service';
import { TempFileStorageService } from '../../src/infrastructure/services/temp-file-storage.service';
import { LibreOfficeConverter } from '../../src/infrastructure/services/libreoffice-converter.service';
import { ConversionQueueService } from '../../src/infrastructure/services/conversion-queue.service';
import { ConvertedPDF } from '../../src/domain/entities/converted-pdf.entity';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('../../src/infrastructure/services/file-validator.service');
jest.mock('../../src/infrastructure/services/temp-file-storage.service');
jest.mock('../../src/infrastructure/services/libreoffice-converter.service');
jest.mock('../../src/infrastructure/services/conversion-queue.service');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));
// Mock fs module for file operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn(() => Buffer.from('mock pdf content')),
}));

describe('ConvertFileUseCase Comprehensive Tests', () => {
  let convertFileUseCase: ConvertFileUseCase;
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

    convertFileUseCase = new ConvertFileUseCase(mockFileValidator, mockStorage, mockConverter);

    // Access the private queue property and replace it with our mock
    (convertFileUseCase as any).conversionQueue = mockQueue;
  });

  describe('Happy path conversions', () => {
    it('should successfully convert a valid DOCX file', async () => {
      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      // Mock storage to create temp directory
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');

      // Mock converter to return a converted file path
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');

      // Mock storage to save PDF
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      // Mock the internal activePDFs map to return a record
      const mockConvertedPDF: ConvertedPDF = {
        id: 'mock-uuid',
        originalDocumentId: 'mock-uuid',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/mock-uuid',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        downloadCount: 0,
      };
      mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

      const result = await convertFileUseCase.execute(mockFile);

      expect(mockFileValidator.validateFile).toHaveBeenCalledWith(mockFile);
      expect(mockStorage.createTempDirectory).toHaveBeenCalled();
      expect(mockConverter.convert).toHaveBeenCalledWith(mockFile.path, '/tmp/convert-12345');
      expect(mockStorage.savePDF).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer));
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('downloadUrl');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('sizeBytes');
      expect(result).toHaveProperty('expiresAt');
      expect(result.id).toBe('mock-uuid');
    });

    it('should successfully convert a valid XLSX file', async () => {
      const xlsxFile = {
        ...mockFile,
        originalname: 'test.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: 'test.xlsx',
      };

      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      // Mock storage to create temp directory
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');

      // Mock converter to return a converted file path
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');

      // Mock storage to save PDF
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      // Mock the internal activePDFs map to return a record
      const mockConvertedPDF: ConvertedPDF = {
        id: 'mock-uuid',
        originalDocumentId: 'mock-uuid',
        filename: 'converted_test.pdf',
        sizeBytes: 2048,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/mock-uuid',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        downloadCount: 0,
      };
      mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

      const result = await convertFileUseCase.execute(xlsxFile);

      expect(mockFileValidator.validateFile).toHaveBeenCalledWith(xlsxFile);
      expect(mockStorage.createTempDirectory).toHaveBeenCalled();
      expect(mockConverter.convert).toHaveBeenCalledWith(xlsxFile.path, '/tmp/convert-12345');
      expect(mockStorage.savePDF).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer));
      expect(result.sizeBytes).toBe(2048);
    });

    it('should successfully convert a valid PPTX file', async () => {
      const pptxFile = {
        ...mockFile,
        originalname: 'test.pptx',
        mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        filename: 'test.pptx',
      };

      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      // Mock storage to create temp directory
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');

      // Mock converter to return a converted file path
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');

      // Mock storage to save PDF
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      // Mock the internal activePDFs map to return a record
      const mockConvertedPDF: ConvertedPDF = {
        id: 'mock-uuid',
        originalDocumentId: 'mock-uuid',
        filename: 'converted_test.pdf',
        sizeBytes: 4096,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/mock-uuid',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        downloadCount: 0,
      };
      mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

      const result = await convertFileUseCase.execute(pptxFile);

      expect(mockFileValidator.validateFile).toHaveBeenCalledWith(pptxFile);
      expect(mockStorage.createTempDirectory).toHaveBeenCalled();
      expect(mockConverter.convert).toHaveBeenCalledWith(pptxFile.path, '/tmp/convert-12345');
      expect(mockStorage.savePDF).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer));
      expect(result.sizeBytes).toBe(4096);
    });
  });

  describe('File validation failures', () => {
    it('should throw an error when file validation fails', async () => {
      const validationError = new Error('Invalid file type');
      mockFileValidator.validateFile.mockRejectedValueOnce(validationError);

      await expect(convertFileUseCase.execute(mockFile)).rejects.toThrow(validationError);
    });

    it('should handle validation errors with specific error types', async () => {
      const validationError = new Error('File too large');
      mockFileValidator.validateFile.mockRejectedValueOnce(validationError);

      await expect(convertFileUseCase.execute(mockFile)).rejects.toThrow('File too large');
    });
  });

  describe('Storage service failures', () => {
    it('should throw an error when temp directory creation fails', async () => {
      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      // Mock directory creation to fail
      const dirError = new Error('Failed to create directory');
      mockStorage.createTempDirectory.mockRejectedValueOnce(dirError);

      await expect(convertFileUseCase.execute(mockFile)).rejects.toThrow(dirError);
    });

    it('should throw an error when PDF saving fails', async () => {
      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      // Mock storage to create temp directory
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');

      // Mock converter to return a converted file path
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');

      // Mock storage to fail saving PDF
      const saveError = new Error('Failed to save PDF');
      mockStorage.savePDF.mockRejectedValueOnce(saveError);

      await expect(convertFileUseCase.execute(mockFile)).rejects.toThrow(saveError);
    });
  });

  describe('Converter service failures', () => {
    it('should throw an error when conversion fails', async () => {
      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      // Mock storage to create temp directory
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');

      // Mock converter to fail
      const conversionError = new Error('Conversion failed');
      mockConverter.convert.mockRejectedValueOnce(conversionError);

      await expect(convertFileUseCase.execute(mockFile)).rejects.toThrow(conversionError);
    });

    it('should handle timeout errors during conversion', async () => {
      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      // Mock storage to create temp directory
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');

      // Mock converter to timeout
      const timeoutError = new Error('Conversion timed out');
      mockConverter.convert.mockRejectedValueOnce(timeoutError);

      await expect(convertFileUseCase.execute(mockFile)).rejects.toThrow(timeoutError);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero-byte files', async () => {
      const zeroByteFile = { ...mockFile, size: 0 };

      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const mockConvertedPDF: ConvertedPDF = {
        id: 'mock-uuid',
        originalDocumentId: 'mock-uuid',
        filename: 'converted_test.pdf',
        sizeBytes: 0,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/mock-uuid',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        downloadCount: 0,
      };
      mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

      const result = await convertFileUseCase.execute(zeroByteFile);

      expect(mockFileValidator.validateFile).toHaveBeenCalledWith(zeroByteFile);
      expect(result.sizeBytes).toBe(0);
    });

    it('should handle large file names', async () => {
      const longNameFile = { ...mockFile, originalname: 'a'.repeat(1000) + '.docx' };

      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const mockConvertedPDF: ConvertedPDF = {
        id: 'mock-uuid',
        originalDocumentId: 'mock-uuid',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/mock-uuid',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        downloadCount: 0,
      };
      mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

      const result = await convertFileUseCase.execute(longNameFile);

      expect(mockFileValidator.validateFile).toHaveBeenCalledWith(longNameFile);
      expect(result).toHaveProperty('id');
    });

    it('should handle files with special characters in name', async () => {
      const specialNameFile = { ...mockFile, originalname: 'test file (2023) [v2].docx' };

      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const mockConvertedPDF: ConvertedPDF = {
        id: 'mock-uuid',
        originalDocumentId: 'mock-uuid',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/mock-uuid',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        downloadCount: 0,
      };
      (mockStorage as any).activePDFs = new Map();
      (mockStorage as any).activePDFs.set('mock-uuid', mockConvertedPDF);

      const result = await convertFileUseCase.execute(specialNameFile);

      expect(mockFileValidator.validateFile).toHaveBeenCalledWith(specialNameFile);
      expect(result).toHaveProperty('id');
    });
  });

  describe('Queue behavior', () => {
    it('should use the conversion queue for processing', async () => {
      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const mockConvertedPDF: ConvertedPDF = {
        id: 'mock-uuid',
        originalDocumentId: 'mock-uuid',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/mock-uuid',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        downloadCount: 0,
      };
      mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

      await convertFileUseCase.execute(mockFile);

      expect(mockQueue.execute).toHaveBeenCalled();
    });

    it('should throw error from queue if conversion fails in queue', async () => {
      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      // Make the queue execution fail
      mockQueue.execute.mockRejectedValueOnce(new Error('Queue processing failed'));

      await expect(convertFileUseCase.execute(mockFile)).rejects.toThrow('Queue processing failed');
    });
  });

  describe('UUID generation', () => {
    it('should use UUID v4 for document ID', async () => {
      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce();

      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');

      const mockConvertedPDF: ConvertedPDF = {
        id: 'mock-uuid',
        originalDocumentId: 'mock-uuid',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/mock-uuid',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        downloadCount: 0,
      };
      mockStorage.getActivePDF.mockReturnValueOnce(mockConvertedPDF);

      await convertFileUseCase.execute(mockFile);

      expect(uuidv4).toHaveBeenCalled();
    });
  });
});
