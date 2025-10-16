import { Router } from 'express';
import upload from '../../infrastructure/config/multer.config';
import { ConversionController } from '../controllers/conversion.controller';
import { fileValidationMiddleware } from '../middleware/validation.middleware';

export default function createConversionRoutes(conversionController: ConversionController) {
  const router = Router();

  // POST /api/v1/convert - Convert uploaded office document to PDF
  router.post('/convert', upload.single('file'), fileValidationMiddleware, (req, res, next) => {
    conversionController.convertFile(req, res).catch(next);
  });

  return router;
}