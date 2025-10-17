import { v4 as uuidv4 } from 'uuid';
import { ITranslationService } from '../interfaces/translation.interface';
import { TranslationItem } from '../../domain/entities/translation-item.entity';
import { TranslatedItem } from '../../domain/entities/translated-item.entity';
import { TranslationJob } from '../../domain/entities/translation-job.entity';
import {
  InvalidLanguageError,
  TokenLimitExceededError,
  ValidationError,
} from '../../domain/errors';
import logger from '../../infrastructure/logger/winston.logger';

/**
 * Use case for translating text items
 * Orchestrates the translation process following Clean Architecture principles
 */
export class TranslateTextUseCase {
  private readonly MAX_TOKENS = 10000;

  constructor(private readonly translationService: ITranslationService) {}

  /**
   * Execute the translation use case
   * @param sourceLanguage ISO 639-1 source language code
   * @param targetLanguage ISO 639-1 target language code
   * @param items Array of text items to translate
   * @returns Array of translated items with preserved IDs and positions
   */
  async execute(
    sourceLanguage: string,
    targetLanguage: string,
    items: TranslationItem[]
  ): Promise<TranslatedItem[]> {
    const requestId = uuidv4();

    logger.info('Translation request started', {
      requestId,
      sourceLanguage,
      targetLanguage,
      itemCount: items.length,
    });

    // Validate business rules
    this.validateBusinessRules(sourceLanguage, targetLanguage, items);

    // Count total tokens
    const totalTokens = await this.countTotalTokens(items);
    logger.info('Token count completed', { requestId, totalTokens });

    // Validate token limit
    if (totalTokens > this.MAX_TOKENS) {
      logger.warn('Token limit exceeded', {
        requestId,
        totalTokens,
        maxTokens: this.MAX_TOKENS,
      });
      throw new TokenLimitExceededError(
        `Text content exceeds the ${this.MAX_TOKENS} token limit`,
        totalTokens,
        this.MAX_TOKENS
      );
    }

    // Create translation job
    const job = new TranslationJob(
      requestId,
      sourceLanguage,
      targetLanguage,
      items,
      new Date(),
      totalTokens
    );

    // Translate each item
    const translatedItems: TranslatedItem[] = [];

    for (const item of job.items) {
      try {
        logger.debug('Translating item', {
          requestId,
          itemId: item.id,
          textLength: item.text.length,
        });

        const translatedText = await this.translationService.translateText(
          item.text,
          job.sourceLanguage,
          job.targetLanguage
        );

        const translatedItem = TranslatedItem.fromTranslation(item, translatedText);
        translatedItems.push(translatedItem);

        logger.debug('Item translated successfully', {
          requestId,
          itemId: item.id,
          resultLength: translatedText.length,
        });
      } catch (error) {
        logger.error('Item translation failed', {
          requestId,
          itemId: item.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Re-throw the error (it's already a domain error from the service)
        throw error;
      }
    }

    logger.info('Translation request completed', {
      requestId,
      itemCount: translatedItems.length,
    });

    return translatedItems;
  }

  /**
   * Validate business rules for the translation request
   */
  private validateBusinessRules(
    sourceLanguage: string,
    targetLanguage: string,
    items: TranslationItem[]
  ): void {
    // Validate items array is not empty
    if (!items || items.length === 0) {
      throw new ValidationError('Items array cannot be empty');
    }

    // Validate source and target languages are different
    if (sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) {
      throw new InvalidLanguageError('Source and target languages must be different');
    }

    // Validate all item IDs are unique
    const ids = items.map(item => item.id);
    const uniqueIds = new Set(ids);

    if (ids.length !== uniqueIds.size) {
      throw new ValidationError('All item IDs must be unique');
    }
  }

  /**
   * Count total tokens across all items
   */
  private async countTotalTokens(items: TranslationItem[]): Promise<number> {
    let totalTokens = 0;

    for (const item of items) {
      const tokens = await this.translationService.countTokens(item.text);
      totalTokens += tokens;
    }

    return totalTokens;
  }
}
