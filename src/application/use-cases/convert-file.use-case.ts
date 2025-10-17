import { UploadedDocument } from '../../domain/entities/uploaded-document.entity';
import { ConvertedPDF } from '../../domain/entities/converted-pdf.entity';
import { IFileValidator } from '../interfaces/file-validator.interface';
import { IStorage } from '../interfaces/storage.interface';
import { IFileConverter } from '../interfaces/file-converter.interface';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import logger from '../../infrastructure/logger/winston.logger';
import { ConversionQueueService } from '../../infrastructure/services/conversion-queue.service';
import { ConversionStatus } from '../../domain/entities/conversion-job.entity';

export interface ConvertFileInput {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  tempPath: string;
}

export interface ConvertFileOutput {
  id: string;
  downloadUrl: string;
  filename: string;
  sizeBytes: number;
  expiresAt: string;
}

export class ConvertFileUseCase {
  private conversionQueue: ConversionQueueService;

  constructor(
    private fileValidator: IFileValidator,
    private storage: IStorage,
    private converter: IFileConverter
  ) {
    this.conversionQueue = new ConversionQueueService();
  }

  async execute(input: Express.Multer.File): Promise<ConvertFileOutput> {
    const startTime = Date.now();

    try {
      logger.info(`Starting conversion process for file: ${input.originalname}`, {
        fileSize: input.size,
        mimeType: input.mimetype,
      });

      // Step 1: Validate the uploaded file
      await this.fileValidator.validateFile(input);

      // Step 2: Create UploadedDocument entity
      const uploadedDocument: UploadedDocument = {
        id: uuidv4(),
        originalFilename: input.originalname,
        mimeType: input.mimetype,
        sizeBytes: input.size,
        tempPath: input.path,
        uploadedAt: new Date(),
        fileExtension: path.extname(input.originalname),
      };

      logger.info(`File validation completed for: ${input.originalname}`);

      // Step 3: Queue the conversion job to manage concurrency
      const result = await this.conversionQueue.execute(async () => {
        logger.info(`Processing conversion in queue for: ${input.originalname}`, {
          activeConversions: this.conversionQueue.getActiveConversionCount(),
          queueLength: this.conversionQueue.getCurrentQueueLength(),
        });

        // Perform the actual conversion
        const outputDir = await this.storage.createTempDirectory();
        const convertedFilePath = await this.converter.convert(input.path, outputDir);

        // Read the converted PDF file
        const pdfBuffer = await fs.readFile(convertedFilePath);

        logger.info(`File conversion completed for: ${input.originalname}`);

        // Save the converted PDF
        const pdfFilePath = await this.storage.savePDF(uploadedDocument.id, pdfBuffer);

        // Get the converted PDF record to return information
        const pdfRecord = (this.storage as any).activePDFs.get(uploadedDocument.id) as ConvertedPDF;

        if (!pdfRecord) {
          throw new Error('Converted PDF record not found after save');
        }

        logger.info(`Conversion use case completed for: ${input.originalname}`, {
          duration: Date.now() - startTime,
          pdfId: pdfRecord.id,
          pdfPath: pdfRecord.tempPath,
        });

        return {
          id: pdfRecord.id,
          downloadUrl: pdfRecord.downloadUrl,
          filename: pdfRecord.filename,
          sizeBytes: pdfRecord.sizeBytes,
          expiresAt: pdfRecord.expiresAt.toISOString(),
        };
      });

      // Log queue metrics
      const queueStatus = this.conversionQueue.getStatus();
      logger.debug('Queue status after conversion', {
        ...queueStatus,
      });

      return result;
    } catch (error) {
      logger.error(`Conversion failed for file: ${input.originalname}`, { error });
      throw error;
    }
  }
}
