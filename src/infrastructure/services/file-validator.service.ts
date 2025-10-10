import { readFile } from 'fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import config from '../config';
import {
  UnsupportedFileTypeError,
  FileTooLargeError,
  InvalidFileSignatureError,
} from '../../domain/errors';
import { IFileValidator } from '../../application/interfaces/file-validator.interface';

export class FileValidator implements IFileValidator {
  async validateFile(file: Express.Multer.File): Promise<void> {
    // Validate file size
    const maxSizeBytes = config.files.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new FileTooLargeError(
        `File size ${file.size} bytes exceeds the maximum allowed size of ${config.files.maxFileSizeMB}MB (${maxSizeBytes} bytes)`
      );
    }

    // Validate MIME type by checking the file signature
    // Since we're using disk storage, we need to read first few bytes from the file path
    let fileBuffer: Buffer;
    
    // If buffer exists (in some Multer configurations), use it directly
    if (file.buffer) {
      fileBuffer = file.buffer;
    } else if (file.path) {
      // Otherwise read from the file path
      fileBuffer = await readFile(file.path);
    } else {
      throw new InvalidFileSignatureError('File buffer or path is not available for validation');
    }

    const detectedType = await fileTypeFromBuffer(fileBuffer);
    
    if (!detectedType) {
      throw new InvalidFileSignatureError('Could not detect file type from signature. The file may be corrupted or in an unsupported format.');
    }

    // List of supported MIME types for office documents
    const supportedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // XLSX
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
      'application/msword', // DOC
      'application/vnd.ms-excel', // XLS
      'application/vnd.ms-powerpoint', // PPT
    ];

    if (!supportedMimeTypes.includes(detectedType.mime)) {
      const supportedTypesList = [
        'DOCX (.docx)', 'XLSX (.xlsx)', 'PPTX (.pptx)', 
        'DOC (.doc)', 'XLS (.xls)', 'PPT (.ppt)'
      ].join(', ');
      
      throw new UnsupportedFileTypeError(
        `Unsupported file type: ${detectedType.mime}. File signature analysis detected type "${detectedType.mime}". ` +
        `Supported types are: ${supportedTypesList}`
      );
    }

    // Additionally check file extension as a secondary validation
    const allowedExtensions = ['.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt'];
    const fileExtension = '.' + file.originalname.split('.').pop()?.toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      const supportedExtensions = allowedExtensions.join(', ');
      
      throw new UnsupportedFileTypeError(
        `Unsupported file extension: ${fileExtension}. ` +
        `File extension does not match the allowed types: ${supportedExtensions}`
      );
    }
  }
}