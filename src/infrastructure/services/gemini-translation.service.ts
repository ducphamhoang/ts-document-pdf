import { GoogleGenAI } from '@google/genai';
import { backOff } from 'exponential-backoff';
import ISO6391 from 'iso-639-1';
import { ITranslationService } from '../../application/interfaces/translation.interface';
import {
  TranslationError,
  TranslationServiceUnavailableError,
  TranslationTimeoutError,
  InvalidLanguageError,
} from '../../domain/errors';
import logger from '../logger/winston.logger';

/**
 * Google Gemini-based translation service implementation
 * Implements ITranslationService using Google's Gemini AI API
 */
export class GeminiTranslationService implements ITranslationService {
  private readonly client: GoogleGenAI;
  private readonly model: string;
  private readonly timeout: number;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    this.client = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-001';
    this.timeout = parseInt(process.env.TRANSLATION_TIMEOUT_MS || '30000', 10);

    logger.info('GeminiTranslationService initialized', {
      model: this.model,
      timeout: this.timeout,
    });
  }

  /**
   * Translate text from source language to target language
   * Uses exponential backoff for retry logic on transient failures
   */
  async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    // Validate languages
    this.validateLanguageCode(sourceLanguage);
    this.validateLanguageCode(targetLanguage);

    const sourceLangName = ISO6391.getName(sourceLanguage);
    const targetLangName = ISO6391.getName(targetLanguage);

    // Create translation prompt
    const prompt = `You are a professional translator. Translate the following text from ${sourceLangName} to ${targetLangName}.

Requirements:
- Preserve the meaning, tone, and style of the original text
- Maintain proper grammar and natural phrasing in the target language
- Keep any special characters, punctuation, and formatting
- Do not add explanations or notes
- Only return the translated text, nothing else

Text to translate:
${text}

Translation:`;

    try {
      // Execute translation with retry logic and timeout
      const translatedText = await this.executeWithRetryAndTimeout(async () => {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: prompt,
        });

        // Extract text from the response
        const result = typeof response === 'string' ? response : response?.text || '';

        if (!result || result.trim().length === 0) {
          throw new TranslationError('Translation service returned empty result');
        }

        return result.trim();
      });

      logger.info('Translation completed', {
        sourceLanguage,
        targetLanguage,
        textLength: text.length,
        resultLength: translatedText.length,
      });

      return translatedText;
    } catch (error) {
      logger.error('Translation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceLanguage,
        targetLanguage,
        textLength: text.length,
      });

      throw this.mapError(error);
    }
  }

  /**
   * Count tokens in the given text
   * Uses Gemini's built-in token counting API
   */
  async countTokens(text: string): Promise<number> {
    try {
      const response = await this.client.models.countTokens({
        model: this.model,
        contents: text,
      });

      const tokenCount = response.totalTokens || 0;

      logger.debug('Token count completed', {
        textLength: text.length,
        tokens: tokenCount,
      });

      return tokenCount;
    } catch (error) {
      logger.error('Token counting failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: text.length,
      });

      throw new TranslationError(
        `Failed to count tokens: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute a function with exponential backoff retry logic and timeout
   */
  private async executeWithRetryAndTimeout<T>(fn: () => Promise<T>): Promise<T> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TranslationTimeoutError(`Translation request timed out after ${this.timeout}ms`));
      }, this.timeout);
    });

    // Execute with retry logic
    const retryPromise = backOff(fn, {
      numOfAttempts: 3,
      startingDelay: 1000,
      maxDelay: 10000,
      timeMultiple: 2,
      jitter: 'full',
      retry: (error: any) => {
        // Retry on transient errors (429, 500-599)
        const status = error?.status || error?.response?.status;

        if (status === 429) {
          logger.warn('Rate limit hit, retrying...', { status });
          return true;
        }

        if (status >= 500 && status < 600) {
          logger.warn('Server error, retrying...', { status });
          return true;
        }

        // Don't retry on client errors (400-499 except 429) or auth errors
        if (status >= 400 && status < 500) {
          logger.error('Client error, not retrying', { status });
          return false;
        }

        // Retry on unknown errors (might be network issues)
        logger.warn('Unknown error, retrying...', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
        return true;
      },
    });

    // Race between retry logic and timeout
    return Promise.race([retryPromise, timeoutPromise]);
  }

  /**
   * Validate that a language code is valid ISO 639-1
   */
  private validateLanguageCode(code: string): void {
    if (!ISO6391.validate(code)) {
      throw new InvalidLanguageError(
        `Invalid language code: "${code}". Must be a valid ISO 639-1 code (e.g., "en", "fr", "es")`
      );
    }
  }

  /**
   * Map API errors to domain errors
   */
  private mapError(error: any): Error {
    const status = error?.status || error?.response?.status;
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Timeout errors
    if (error instanceof TranslationTimeoutError) {
      return error;
    }

    // Auth errors (401, 403)
    if (status === 401 || status === 403) {
      return new TranslationServiceUnavailableError(
        'Translation service authentication failed. Please check API key.'
      );
    }

    // Client errors (400-499)
    if (status >= 400 && status < 500) {
      return new TranslationError(`Translation request invalid: ${message}`);
    }

    // Server errors (500-599)
    if (status >= 500 && status < 600) {
      return new TranslationServiceUnavailableError(
        `Translation service is temporarily unavailable: ${message}`
      );
    }

    // Generic translation error
    return new TranslationError(`Translation failed: ${message}`);
  }
}
