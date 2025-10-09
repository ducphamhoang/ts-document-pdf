import { ConvertFileUseCase } from '../../src/application/use-cases/convert-file.use-case';
import { FileValidator } from '../../src/infrastructure/services/file-validator.service';
import { TempFileStorageService } from '../../src/infrastructure/services/temp-file-storage.service';
import { LibreOfficeConverter } from '../../src/infrastructure/services/libreoffice-converter.service';

// Mock dependencies
jest.mock('../../src/infrastructure/services/file-validator.service');
jest.mock('../../src/infrastructure/services/temp-file-storage.service');
jest.mock('../../src/infrastructure/services/libreoffice-converter.service');

describe('ConvertFileUseCase', () => {
  let convertFileUseCase: ConvertFileUseCase;
  let mockFileValidator: jest.Mocked<FileValidator>;
  let mockStorage: jest.Mocked<TempFileStorageService>;
  let mockConverter: jest.Mocked<LibreOfficeConverter>;

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
    
    convertFileUseCase = new ConvertFileUseCase(
      mockFileValidator,
      mockStorage,
      mockConverter
    );
  });

  describe('execute', () => {
    it('should successfully convert a valid file', async () => {
      // Mock file validation to pass
      mockFileValidator.validateFile.mockResolvedValueOnce(Promise.resolve());
      
      // Mock storage to create temp directory
      mockStorage.createTempDirectory.mockResolvedValueOnce('/tmp/convert-12345');
      
      // Mock converter to return a converted file path
      mockConverter.convert.mockResolvedValueOnce('/tmp/converted_test.pdf');
      
      // Mock storage to save PDF
      mockStorage.savePDF.mockResolvedValueOnce('/tmp/converted_test.pdf');
      
      // Mock the internal activePDFs map to return a record
      (mockStorage as any).activePDFs = new Map();
      (mockStorage as any).activePDFs.set('mock-uuid', {
        id: 'mock-uuid',
        originalDocumentId: 'mock-uuid',
        filename: 'converted_test.pdf',
        sizeBytes: 1024,
        tempPath: '/tmp/converted_test.pdf',
        downloadUrl: 'http://localhost:3000/downloads/mock-uuid',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        downloadCount: 0,
      });

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
    });

    it('should throw an error when file validation fails', async () => {
      const validationError = new Error('Invalid file type');
      mockFileValidator.validateFile.mockRejectedValueOnce(validationError);

      await expect(convertFileUseCase.execute(mockFile))
        .rejects
        .toThrow(validationError);
    });
  });
});