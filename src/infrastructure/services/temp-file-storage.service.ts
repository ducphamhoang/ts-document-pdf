import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { UploadedDocument } from '../../domain/entities/uploaded-document.entity';
import { ConvertedPDF } from '../../domain/entities/converted-pdf.entity';
import { IStorage } from '../../application/interfaces/storage.interface';
import { FileNotFoundError } from '../../domain/errors';
import config from '../config';
import logger from '../logger/winston.logger';

export class TempFileStorageService implements IStorage {
  private activePDFs: Map<string, ConvertedPDF> = new Map();

  async createTempDirectory(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'convert-'));
    logger.info(`Created temporary directory: ${tempDir}`);
    return tempDir;
  }

  async savePDF(originalDocumentId: string, pdfBuffer: Buffer): Promise<string> {
    const tempDir = await this.createTempDirectory();
    const fileName = `converted_${originalDocumentId}.pdf`;
    const filePath = path.join(tempDir, fileName);

    await fs.writeFile(filePath, pdfBuffer);

    // Create a new ConvertedPDF entity
    const id = originalDocumentId; // Using original document ID as the PDF ID for simplicity
    const convertedPDF: ConvertedPDF = {
      id,
      originalDocumentId,
      filename: fileName,
      sizeBytes: pdfBuffer.length,
      tempPath: filePath,
      downloadUrl: `${config.server.baseUrl}/downloads/${id}`,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + config.files.retentionHours * 60 * 60 * 1000), // Add retention hours
      downloadCount: 0,
    };

    this.activePDFs.set(id, convertedPDF);

    logger.info(`Saved converted PDF: ${filePath}`);
    return filePath;
  }

  async getPDF(fileId: string): Promise<{ path: string; buffer: Buffer } | null> {
    const pdfRecord = this.activePDFs.get(fileId);

    if (!pdfRecord) {
      throw new FileNotFoundError(`Converted PDF with ID ${fileId} not found`);
    }

    // Check if the file has expired
    if (pdfRecord.expiresAt < new Date()) {
      await this.deletePDF(fileId);
      throw new FileNotFoundError(`Converted PDF with ID ${fileId} has expired`);
    }

    try {
      const buffer = await fs.readFile(pdfRecord.tempPath);
      return {
        path: pdfRecord.tempPath,
        buffer,
      };
    } catch (error) {
      logger.error(`Error reading PDF file: ${error}`);
      throw new FileNotFoundError(`Converted PDF with ID ${fileId} could not be read`);
    }
  }

  async deletePDF(fileId: string): Promise<void> {
    const pdfRecord = this.activePDFs.get(fileId);

    if (!pdfRecord) {
      logger.warn(`Attempted to delete non-existent PDF with ID: ${fileId}`);
      return;
    }

    try {
      await fs.unlink(pdfRecord.tempPath);
      // Also try to remove the parent directory if it exists and is empty
      const dirPath = path.dirname(pdfRecord.tempPath);
      try {
        await fs.rmdir(dirPath);
        logger.info(`Removed empty temporary directory: ${dirPath}`);
      } catch (rmdirErr) {
        // Directory not empty, which is fine - just means there are other files
        logger.info(`Skipped removing non-empty directory: ${dirPath}`);
      }
    } catch (error) {
      logger.error(`Error deleting PDF file: ${error}`);
    } finally {
      this.activePDFs.delete(fileId);
      logger.info(`Deleted PDF record and file for ID: ${fileId}`);
    }
  }

  async cleanup(): Promise<void> {
    const now = new Date();
    const expiredPDFs = Array.from(this.activePDFs.entries()).filter(
      ([, pdfRecord]) => pdfRecord.expiresAt < now
    );

    for (const [fileId] of expiredPDFs) {
      await this.deletePDF(fileId);
    }

    logger.info(`Cleanup completed. Removed ${expiredPDFs.length} expired PDFs.`);
  }

  // Getter to access active PDFs (needed for the download use case)
  getActivePDF(fileId: string) {
    return this.activePDFs.get(fileId);
  }
}
