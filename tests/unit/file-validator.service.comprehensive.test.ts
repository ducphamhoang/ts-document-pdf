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

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

describe('FileValidator Comprehensive Tests', () => {
  let fileValidator: FileValidator;
  
  const validDocxFile: Express.Multer.File = {
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

  const validXlsxFile: Express.Multer.File = {
    ...validDocxFile,
    originalname: 'test.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: 'test.xlsx',
  };

  const validPptxFile: Express.Multer.File = {
    ...validDocxFile,
    originalname: 'test.pptx',
    mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    filename: 'test.pptx',
  };

  const validLegacyFiles = [
    { originalname: 'test.doc', mimetype: 'application/msword' },
    { originalname: 'test.xls', mimetype: 'application/vnd.ms-excel' },
    { originalname: 'test.ppt', mimetype: 'application/vnd.ms-powerpoint' }
  ];

  beforeEach(() => {
    fileValidator = new FileValidator();
    jest.clearAllMocks();
  });

  describe('Happy path validations', () => {
    it('should accept a valid DOCX file', async () => {
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'docx', 
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      await expect(fileValidator.validateFile(validDocxFile)).resolves.not.toThrow();
    });

    it('should accept a valid XLSX file', async () => {
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'xlsx', 
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      await expect(fileValidator.validateFile(validXlsxFile)).resolves.not.toThrow();
    });

    it('should accept a valid PPTX file', async () => {
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'pptx', 
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });

      await expect(fileValidator.validateFile(validPptxFile)).resolves.not.toThrow();
    });

    it.each(validLegacyFiles)('should accept a valid legacy file %s', async (fileData) => {
      const file = { ...validDocxFile, ...fileData, filename: fileData.originalname };
      const mimeToExtMap: Record<string, string> = {
        'application/msword': 'doc',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.ms-powerpoint': 'ppt'
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: mimeToExtMap[fileData.mimetype], 
        mime: fileData.mimetype 
      });

      await expect(fileValidator.validateFile(file)).resolves.not.toThrow();
    });
  });

  describe('File size validation', () => {
    it('should throw FileTooLargeError when file exceeds maximum size', async () => {
      const maxFileSizeBytes = config.files.maxFileSizeMB * 1024 * 1024;
      const tooLargeFile = { 
        ...validDocxFile, 
        size: maxFileSizeBytes + 1 // 1 byte over the limit
      };

      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'docx', 
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      await expect(fileValidator.validateFile(tooLargeFile))
        .rejects
        .toThrow(FileTooLargeError);
    });

    it('should accept file at maximum size limit', async () => {
      const maxFileSizeBytes = config.files.maxFileSizeMB * 1024 * 1024;
      const fileAtLimit = { 
        ...validDocxFile, 
        size: maxFileSizeBytes 
      };

      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'docx', 
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      await expect(fileValidator.validateFile(fileAtLimit)).resolves.not.toThrow();
    });

    it('should accept file under maximum size limit', async () => {
      const fileUnderLimit = { 
        ...validDocxFile, 
        size: config.files.maxFileSizeMB * 1024 * 1024 - 100 // A bit under the limit
      };

      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'docx', 
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      await expect(fileValidator.validateFile(fileUnderLimit)).resolves.not.toThrow();
    });
  });

  describe('File signature validation', () => {
    it('should throw InvalidFileSignatureError when file signature cannot be detected', async () => {
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce(null);

      await expect(fileValidator.validateFile(validDocxFile))
        .rejects
        .toThrow(InvalidFileSignatureError);
    });

    it('should throw InvalidFileSignatureError when file type detection fails', async () => {
      (fileTypeFromBuffer as jest.Mock).mockRejectedValueOnce(new Error('Invalid file'));

      await expect(fileValidator.validateFile(validDocxFile))
        .rejects
        .toThrow(InvalidFileSignatureError);
    });

    it('should throw InvalidFileSignatureError when file buffer or path is not available', async () => {
      const invalidFile = { ...validDocxFile };
      delete (invalidFile as any).buffer;
      (invalidFile as any).path = undefined;

      await expect(fileValidator.validateFile(invalidFile))
        .rejects
        .toThrow(InvalidFileSignatureError);
    });
  });

  describe('Mime type validation', () => {
    it('should throw UnsupportedFileTypeError when mime type is not supported', async () => {
      const unsupportedFile = { 
        ...validDocxFile, 
        originalname: 'test.pdf',
        mimetype: 'application/pdf' 
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'pdf', 
        mime: 'application/pdf' 
      });

      await expect(fileValidator.validateFile(unsupportedFile))
        .rejects
        .toThrow(UnsupportedFileTypeError);
    });

    it('should throw UnsupportedFileTypeError when mime type is unknown', async () => {
      const unsupportedFile = { 
        ...validDocxFile, 
        originalname: 'test.txt',
        mimetype: 'text/plain' 
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'txt', 
        mime: 'text/plain' 
      });

      await expect(fileValidator.validateFile(unsupportedFile))
        .rejects
        .toThrow(UnsupportedFileTypeError);
    });

    it('should throw UnsupportedFileTypeError when mime type is an image', async () => {
      const unsupportedFile = { 
        ...validDocxFile, 
        originalname: 'test.jpg',
        mimetype: 'image/jpeg' 
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'jpg', 
        mime: 'image/jpeg' 
      });

      await expect(fileValidator.validateFile(unsupportedFile))
        .rejects
        .toThrow(UnsupportedFileTypeError);
      await expect(fileValidator.validateFile(unsupportedFile))
        .rejects.toThrow('jpeg');
    });
  });

  describe('File extension validation', () => {
    it('should throw UnsupportedFileTypeError when file extension is not supported', async () => {
      const unsupportedFile = { 
        ...validDocxFile, 
        originalname: 'test.pdf',
        mimetype: 'application/pdf' 
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'pdf', 
        mime: 'application/pdf' 
      });

      await expect(fileValidator.validateFile(unsupportedFile))
        .rejects
        .toThrow(UnsupportedFileTypeError);
      await expect(fileValidator.validateFile(unsupportedFile))
        .rejects.toThrow('.pdf');
    });

    it('should throw UnsupportedFileTypeError when file has no extension', async () => {
      const fileWithoutExt = { 
        ...validDocxFile, 
        originalname: 'test',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'docx', 
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      await expect(fileValidator.validateFile(fileWithoutExt))
        .rejects
        .toThrow(UnsupportedFileTypeError);
    });

    it('should handle mixed case file extensions', async () => {
      // Test uppercase extension
      const uppercaseFile = { 
        ...validDocxFile, 
        originalname: 'test.DOCX',
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'docx', 
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      await expect(fileValidator.validateFile(uppercaseFile)).resolves.not.toThrow();

      // Test mixed case extension
      const mixedCaseFile = { 
        ...validDocxFile, 
        originalname: 'test.DoCx',
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'docx', 
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      await expect(fileValidator.validateFile(mixedCaseFile)).resolves.not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle files with multiple dots in name', async () => {
      const dottedFile = { 
        ...validDocxFile, 
        originalname: 'test.backup.docx',
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'docx', 
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      await expect(fileValidator.validateFile(dottedFile)).resolves.not.toThrow();
    });

    it('should handle files with special characters in name', async () => {
      const specialCharFile = { 
        ...validDocxFile, 
        originalname: 'test_file (2023).docx',
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'docx', 
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      await expect(fileValidator.validateFile(specialCharFile)).resolves.not.toThrow();
    });

    it('should validate empty files', async () => {
      const emptyFile = { 
        ...validDocxFile, 
        size: 0,
        originalname: 'empty.docx'
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'docx', 
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      await expect(fileValidator.validateFile(emptyFile)).resolves.not.toThrow();
    });

    it('should properly validate file signatures when buffer is not available', async () => {
      // Mock fs.readFile to return a buffer when path is provided
      const fs = require('fs/promises');
      jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('mock file content'));
      
      const fileWithoutBuffer = {
        ...validDocxFile,
        buffer: undefined as any // Remove buffer to force reading from file path
      };
      
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ 
        ext: 'docx', 
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      await expect(fileValidator.validateFile(fileWithoutBuffer)).resolves.not.toThrow();
      expect(fs.readFile).toHaveBeenCalledWith(validDocxFile.path);
    });
  });
});