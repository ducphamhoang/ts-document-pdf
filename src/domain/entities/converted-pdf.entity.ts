export interface ConvertedPDF {
  id: string;
  originalDocumentId: string;
  filename: string;
  sizeBytes: number;
  tempPath: string;
  downloadUrl: string;
  createdAt: Date;
  expiresAt: Date;
  downloadCount: number;
}