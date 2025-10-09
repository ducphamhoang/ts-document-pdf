import { Router } from 'express';
import { ConversionController } from '../controllers/conversion.controller';

export default function createDownloadRoutes(conversionController: ConversionController) {
  const router = Router();

  // GET /downloads/:fileId - Download converted PDF file
  router.get('/downloads/:fileId', (req, res, next) => {
    conversionController.downloadFile(req, res).catch(next);
  });

  return router;
}