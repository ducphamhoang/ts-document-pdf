export interface UploadedDocument {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  tempPath: string;
  uploadedAt: Date;
  fileExtension: string;
}