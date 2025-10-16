import { IStorage } from '../interfaces/storage.interface';
import { ConvertedPDF } from '../../domain/entities/converted-pdf.entity';
import { FileNotFoundError } from '../../domain/errors';

export interface DownloadFileInput {
  fileId: string;
}

export interface DownloadFileOutput {
  pdfRecord: ConvertedPDF;
  filePath: string;
  fileBuffer: Buffer;
}

export class DownloadFileUseCase {
  constructor(private storage: IStorage) {}

  async execute(fileId: string): Promise<DownloadFileOutput> {
    // Get the PDF from storage
    const result = await this.storage.getPDF(fileId);
    
    if (!result) {
      // The getPDF method already handles expired files and throws FileNotFoundError
      // if the file doesn't exist or is expired
      throw new FileNotFoundError(`PDF with ID ${fileId} not found`);
    }
    
    // Get the PDF record from storage
    const pdfRecord = this.storage.getActivePDF(fileId);
    
    if (!pdfRecord) {
      throw new FileNotFoundError(`PDF record with ID ${fileId} not found`);
    }
    
    // Update download count
    pdfRecord.downloadCount += 1;
    
    return {
      pdfRecord,
      filePath: result.path,
      fileBuffer: result.buffer,
    };
  }
}