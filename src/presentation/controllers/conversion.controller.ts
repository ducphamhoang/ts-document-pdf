import { Request, Response } from 'express';
import { ConvertFileUseCase } from '../../application/use-cases/convert-file.use-case';
import { DownloadFileUseCase } from '../../application/use-cases/download-file.use-case';
import { ConvertSuccessResponse } from '../dto/convert-response.dto';
import logger from '../../infrastructure/logger/winston.logger';

export class ConversionController {
  constructor(
    private convertFileUseCase: ConvertFileUseCase,
    private downloadFileUseCase: DownloadFileUseCase
  ) {}

  async convertFile(req: Request, res: Response): Promise<void> {
    try {
      // Check if file was uploaded
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            type: 'MissingFileError',
            message: 'No file uploaded. Please include a file in the \'file\' field.',
            timestamp: new Date().toISOString(),
          }
        });
        return;
      }

      // Execute the conversion use case
      const result = await this.convertFileUseCase.execute(req.file);

      // Prepare success response
      const response: ConvertSuccessResponse = {
        success: true,
        data: {
          id: result.id,
          downloadUrl: result.downloadUrl,
          filename: result.filename,
          sizeBytes: result.sizeBytes,
          expiresAt: result.expiresAt,
        }
      };

      // Send success response
      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in conversion controller', { error });
      // Error handling is done by the error middleware
      throw error;
    }
  }

  async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      
      if (!fileId) {
        res.status(400).json({
          success: false,
          error: {
            type: 'MissingFileIdError',
            message: 'File ID is required to download the PDF.',
            timestamp: new Date().toISOString(),
          }
        });
        return;
      }

      // Execute the download use case
      const result = await this.downloadFileUseCase.execute(fileId);

      // Set appropriate headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${result.pdfRecord.filename}"`);
      res.setHeader('Content-Length', result.fileBuffer.length.toString());

      // Send the PDF file
      res.status(200).send(result.fileBuffer);
    } catch (error) {
      logger.error('Error in download controller', { error });
      // Error handling is done by the error middleware
      throw error;
    }
  }
}