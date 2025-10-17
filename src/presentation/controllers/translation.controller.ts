import { Request, Response, NextFunction } from 'express';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { TranslateTextUseCase } from '../../application/use-cases/translate-text.use-case';
import { TranslationItem } from '../../domain/entities/translation-item.entity';
import { TranslateRequestDto } from '../dto/translate-request.dto';
import { TranslateResponseDto } from '../dto/translate-response.dto';
import logger from '../../infrastructure/logger/winston.logger';

/**
 * Translation controller
 * Handles HTTP requests for the translation API
 */
export class TranslationController {
  constructor(private readonly translateTextUseCase: TranslateTextUseCase) {}

  /**
   * Handle POST /api/v1/translate requests
   */
  translate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Parse and validate request DTO
      const requestDto = plainToClass(TranslateRequestDto, req.body);
      const validationErrors = await validate(requestDto);

      if (validationErrors.length > 0) {
        const errorMessages = validationErrors
          .map(error => Object.values(error.constraints || {}).join(', '))
          .join('; ');

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: {
            code: 'INVALID_REQUEST',
            details: {
              validation: errorMessages,
              fields: validationErrors.map(e => e.property),
            },
          },
        });
        return;
      }

      logger.info('Translation request received', {
        sourceLanguage: requestDto.sourceLanguage,
        targetLanguage: requestDto.targetLanguage,
        itemCount: requestDto.items.length,
      });

      // Convert DTOs to domain entities
      const translationItems = requestDto.items.map(item =>
        TranslationItem.from({
          id: item.id,
          text: item.text,
          position: {
            page: item.position.page,
            x: item.position.x,
            y: item.position.y,
          },
        })
      );

      // Execute use case
      const translatedItems = await this.translateTextUseCase.execute(
        requestDto.sourceLanguage,
        requestDto.targetLanguage,
        translationItems
      );

      // Format response
      const response: TranslateResponseDto = {
        success: true,
        message: 'Text translated successfully.',
        data: translatedItems.map(item => ({
          id: item.id,
          text: item.text,
          position: item.position,
        })),
      };

      logger.info('Translation request completed successfully', {
        itemCount: response.data.length,
      });

      res.status(200).json(response);
    } catch (error) {
      // Pass errors to error handling middleware
      next(error);
    }
  };
}
