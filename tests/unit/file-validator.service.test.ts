import { FileValidator } from '../../src/infrastructure/services/file-validator.service';
import { fileTypeFromBuffer } from 'file-type';
import config from '../../src/infrastructure/config';
import { 
  UnsupportedFileTypeError, 
  FileTooLargeError, 
  InvalidFileSignatureError 
} from '../../src/domain/errors';

// Mock dependencies
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
}));

describe('FileValidator', () => {
  let fileValidator: FileValidator;
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
    fileValidator = new FileValidator();
    jest.clearAllMocks();
  });

  describe('validateFile', () => {
    it('should pass validation for a valid DOCX file', async () => {
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      await expect(fileValidator.validateFile(mockFile)).resolves.not.toThrow();
    });

    it('should throw FileTooLargeError for files exceeding size limit', async () => {
      // Set file size to be larger than max allowed
      const largeFile = { ...mockFile, size: config.files.maxFileSizeMB * 1024 * 1024 + 1 };

      await expect(fileValidator.validateFile(largeFile))
        .rejects
        .toThrow(FileTooLargeError);
    });

    it('should throw InvalidFileSignatureError when file type cannot be detected', async () => {
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce(null as any);

      await expect(fileValidator.validateFile(mockFile))
        .rejects
        .toThrow(InvalidFileSignatureError);
    });

    it('should throw UnsupportedFileTypeError for unsupported MIME types', async () => {
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ ext: 'pdf', mime: 'application/pdf' });

      await expect(fileValidator.validateFile(mockFile))
        .rejects
        .toThrow(UnsupportedFileTypeError);
    });

    it('should throw UnsupportedFileTypeError for unsupported file extensions', async () => {
      const unsupportedFile = { 
        ...mockFile, 
        originalname: 'test.pdf',
        mimetype: 'application/pdf'
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ ext: 'pdf', mime: 'application/pdf' });

      await expect(fileValidator.validateFile(unsupportedFile))
        .rejects
        .toThrow(UnsupportedFileTypeError);
    });
  });
});