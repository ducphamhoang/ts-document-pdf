import { FileValidator } from '../infrastructure/services/file-validator.service';
import { TempFileStorageService } from '../infrastructure/services/temp-file-storage.service';
import { LibreOfficeConverter } from '../infrastructure/services/libreoffice-converter.service';
import { ConvertFileUseCase } from '../application/use-cases/convert-file.use-case';
import { DownloadFileUseCase } from '../application/use-cases/download-file.use-case';
import { ConversionController } from '../presentation/controllers/conversion.controller';
import { FileCleanupService } from '../infrastructure/services/file-cleanup.service';

// Create singleton instances to be shared across the application
const storageService = new TempFileStorageService();
const fileValidator = new FileValidator();
const converterService = new LibreOfficeConverter();
const convertFileUseCase = new ConvertFileUseCase(fileValidator, storageService, converterService);
const downloadFileUseCase = new DownloadFileUseCase(storageService);
const conversionController = new ConversionController(convertFileUseCase, downloadFileUseCase);
const cleanupService = new FileCleanupService(storageService);

export {
  storageService,
  fileValidator,
  converterService,
  convertFileUseCase,
  downloadFileUseCase,
  conversionController,
  cleanupService
};