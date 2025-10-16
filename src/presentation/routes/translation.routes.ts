import { Router } from 'express';
import { TranslationController } from '../controllers/translation.controller';
import { TranslateTextUseCase } from '../../application/use-cases/translate-text.use-case';
import { GeminiTranslationService } from '../../infrastructure/services/gemini-translation.service';

/**
 * Create and configure translation routes
 * @returns Express router with translation endpoints
 */
export function createTranslationRoutes(): Router {
  const router = Router();

  // Initialize dependencies
  const translationService = new GeminiTranslationService();
  const translateTextUseCase = new TranslateTextUseCase(translationService);
  const translationController = new TranslationController(translateTextUseCase);

  // POST /api/v1/translate
  router.post('/translate', translationController.translate);

  return router;
}
