export interface IFileValidator {
  validateFile(file: Express.Multer.File): Promise<void>;
}
