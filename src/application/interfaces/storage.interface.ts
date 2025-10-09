import { ConvertedPDF } from '../../domain/entities/converted-pdf.entity';

export interface IStorage {
  createTempDirectory(): Promise<string>;
  savePDF(originalDocumentId: string, pdfBuffer: Buffer): Promise<string>;
  getPDF(fileId: string): Promise<{ path: string; buffer: Buffer } | null>;
  deletePDF(fileId: string): Promise<void>;
  cleanup(): Promise<void>;
  getActivePDF(fileId: string): ConvertedPDF | undefined;
}