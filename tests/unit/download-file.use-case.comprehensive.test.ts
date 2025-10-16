import { DownloadFileUseCase } from '../../src/application/use-cases/download-file.use-case';
import { TempFileStorageService } from '../../src/infrastructure/services/temp-file-storage.service';
import { ConvertedPDF } from '../../src/domain/entities/converted-pdf.entity';
import { FileNotFoundError } from '../../src/domain/errors';

// Mock dependencies
jest.mock('../../src/infrastructure/services/temp-file-storage.service');

describe('DownloadFileUseCase Comprehensive Tests', () => {
  let downloadFileUseCase: DownloadFileUseCase;
  let mockStorage: jest.Mocked<TempFileStorageService>;

  const mockPDFRecord: ConvertedPDF = {
    id: 'test-pdf-id',
    originalDocumentId: 'original-doc-id',
    filename: 'converted_test.pdf',
    sizeBytes: 1024,
    tempPath: '/tmp/converted_test.pdf',
    downloadUrl: 'http://localhost:3000/downloads/test-pdf-id',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 22), // 22 hours from now
    downloadCount: 0,
  };

  beforeEach(() => {
    mockStorage = new (TempFileStorageService as any)();
    downloadFileUseCase = new DownloadFileUseCase(mockStorage);
  });

  describe('Happy path downloads', () => {
    it('should successfully download an existing PDF', async () => {
      // Mock storage to return PDF details
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      // Mock both getPDF and getActivePDF to return the correct data
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getActivePDF.mockReturnValueOnce({ ...mockPDFRecord });

      const result = await downloadFileUseCase.execute('test-pdf-id');

      expect(mockStorage.getPDF).toHaveBeenCalledWith('test-pdf-id');
      expect(result.pdfRecord.id).toBe('test-pdf-id');
      expect(result.filePath).toBe('/tmp/converted_test.pdf');
      expect(result.fileBuffer).toEqual(Buffer.from('mock pdf content'));
      expect(result.pdfRecord.downloadCount).toBe(1); // Should be incremented
    });

    it('should increment download count on successful download', async () => {
      // Mock storage to return PDF details
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getActivePDF.mockReturnValueOnce({ ...mockPDFRecord, downloadCount: 5 });

      const result = await downloadFileUseCase.execute('test-pdf-id');

      expect(result.pdfRecord.downloadCount).toBe(6); // Should be incremented from 5 to 6
    });
  });

  describe('Missing file scenarios', () => {
    it('should throw FileNotFoundError when PDF does not exist', async () => {
      // Mock storage to return null when PDF doesn't exist
      mockStorage.getPDF.mockResolvedValueOnce(null);

      await expect(downloadFileUseCase.execute('non-existent-id'))
        .rejects
        .toThrow(FileNotFoundError);
    });

    it('should throw FileNotFoundError with specific message for missing PDF', async () => {
      // Mock storage to return null when PDF doesn't exist
      mockStorage.getPDF.mockResolvedValueOnce(null);

      await expect(downloadFileUseCase.execute('non-existent-id'))
        .rejects
        .toThrow('PDF with ID non-existent-id not found');
    });

    it('should throw FileNotFoundError when PDF record does not exist in storage', async () => {
      // Mock storage to return PDF details but record doesn't exist in activePDFs
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      jest.spyOn(mockStorage, 'getActivePDF').mockReturnValue(null as any); // Return null for missing record

      await expect(downloadFileUseCase.execute('non-existent-record-id'))
        .rejects
        .toThrow(FileNotFoundError);
    });

    it('should throw FileNotFoundError with specific message when PDF record does not exist', async () => {
      // Mock storage to return PDF details but record doesn't exist in activePDFs
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      jest.spyOn(mockStorage, 'getActivePDF').mockReturnValue(null as any); // Return null for missing record

      await expect(downloadFileUseCase.execute('non-existent-record-id'))
        .rejects
        .toThrow('PDF record with ID non-existent-record-id not found');
    });
  });

  describe('Expired file scenarios', () => {
    it('should throw FileNotFoundError when PDF has expired', async () => {
      const expiredPDF: ConvertedPDF = {
        ...mockPDFRecord,
        expiresAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago (expired)
      };

      // Mock storage to throw FileNotFoundError for expired files
      mockStorage.getPDF.mockRejectedValueOnce(new FileNotFoundError(`Converted PDF with ID test-pdf-id has expired`));
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getActivePDF.mockReturnValueOnce(expiredPDF);

      await expect(downloadFileUseCase.execute('test-pdf-id'))
        .rejects
        .toThrow(FileNotFoundError);
    });

    it('should throw FileNotFoundError with expired message', async () => {
      // Mock storage to throw FileNotFoundError for expired files
      mockStorage.getPDF.mockRejectedValueOnce(new FileNotFoundError(`Converted PDF with ID expired-pdf-id has expired`));

      await expect(downloadFileUseCase.execute('expired-pdf-id'))
        .rejects
        .toThrow('Converted PDF with ID expired-pdf-id has expired');
    });
  });

  describe('Storage service errors', () => {
    it('should propagate errors from storage service', async () => {
      const storageError = new Error('Storage service error');
      mockStorage.getPDF.mockRejectedValueOnce(storageError);

      await expect(downloadFileUseCase.execute('test-pdf-id'))
        .rejects
        .toThrow('Storage service error');
    });

    it('should handle file read errors', async () => {
      const fileReadError = new Error('Cannot read file');
      mockStorage.getPDF.mockRejectedValueOnce(fileReadError);

      await expect(downloadFileUseCase.execute('test-pdf-id'))
        .rejects
        .toThrow('Cannot read file');
    });
  });

  describe('Edge cases', () => {
    it('should handle PDF with zero download count', async () => {
      const pdfWithZeroDownloads = { 
        ...mockPDFRecord, 
        downloadCount: 0 
      };
      
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getActivePDF.mockReturnValueOnce(pdfWithZeroDownloads);

      const result = await downloadFileUseCase.execute('test-pdf-id');

      expect(result.pdfRecord.downloadCount).toBe(1); // Should be incremented from 0 to 1
    });

    it('should handle large PDF files', async () => {
      const largePDFBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB buffer
      const largePDFRecord = { 
        ...mockPDFRecord, 
        sizeBytes: largePDFBuffer.length 
      };
      
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/large_file.pdf',
        buffer: largePDFBuffer,
      });
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/large_file.pdf',
        buffer: largePDFBuffer,
      });
      mockStorage.getActivePDF.mockReturnValueOnce(largePDFRecord);

      const result = await downloadFileUseCase.execute('large-pdf-id');

      expect(result.fileBuffer.length).toBe(largePDFBuffer.length);
      expect(result.pdfRecord.sizeBytes).toBe(largePDFBuffer.length);
    });

    it('should handle PDF with special characters in filename', async () => {
      const specialCharPDF = { 
        ...mockPDFRecord, 
        filename: 'file_with_special_chars (2023).pdf' 
      };
      
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/file_with_special_chars (2023).pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/file_with_special_chars (2023).pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getActivePDF.mockReturnValueOnce(specialCharPDF);

      const result = await downloadFileUseCase.execute('special-pdf-id');

      expect(result.pdfRecord.filename).toBe('file_with_special_chars (2023).pdf');
      expect(result.filePath).toBe('/tmp/file_with_special_chars (2023).pdf');
    });

    it('should handle very old PDF files (not expired)', async () => {
      const oldPDF = { 
        ...mockPDFRecord, 
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 23), // 23 hours ago
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 1) // 1 hour from now (expires soon)
      };
      
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/old_file.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/old_file.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getActivePDF.mockReturnValueOnce(oldPDF);

      const result = await downloadFileUseCase.execute('old-pdf-id');

      expect(result.pdfRecord.createdAt.getTime()).toBe(oldPDF.createdAt.getTime());
      expect(result.pdfRecord.expiresAt.getTime()).toBe(oldPDF.expiresAt.getTime());
    });
  });

  describe('Download count tracking', () => {
    it('should increment download count correctly', async () => {
      const initialCount = 42;
      const pdfWithCount = { 
        ...mockPDFRecord, 
        downloadCount: initialCount 
      };
      
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getActivePDF.mockReturnValueOnce(pdfWithCount);

      const result = await downloadFileUseCase.execute('test-pdf-id');

      expect(result.pdfRecord.downloadCount).toBe(initialCount + 1);
    });

    it('should maintain download count across multiple downloads', async () => {
      const pdfWithCount = { 
        ...mockPDFRecord, 
        downloadCount: 3 
      };
      
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getActivePDF.mockReturnValueOnce(pdfWithCount);

      const result = await downloadFileUseCase.execute('test-pdf-id');

      expect(result.pdfRecord.downloadCount).toBe(4);
    });
  });

  describe('File path handling', () => {
    it('should return the correct file path', async () => {
      const expectedPath = '/tmp/unique_converted_file.pdf';
      
      mockStorage.getPDF.mockResolvedValueOnce({
        path: expectedPath,
        buffer: Buffer.from('mock pdf content'),
      });
      mockStorage.getActivePDF.mockReturnValueOnce(mockPDFRecord);

      const result = await downloadFileUseCase.execute('test-pdf-id');

      expect(result.filePath).toBe(expectedPath);
    });

    it('should return the correct file buffer', async () => {
      const expectedBuffer = Buffer.from('this is the pdf content');
      
      mockStorage.getPDF.mockResolvedValueOnce({
        path: '/tmp/converted_test.pdf',
        buffer: expectedBuffer,
      });
      mockStorage.getActivePDF.mockReturnValueOnce(mockPDFRecord);

      const result = await downloadFileUseCase.execute('test-pdf-id');

      expect(result.fileBuffer).toEqual(expectedBuffer);
    });
  });
});