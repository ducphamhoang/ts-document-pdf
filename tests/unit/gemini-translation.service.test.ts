import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GeminiTranslationService } from '../../src/infrastructure/services/gemini-translation.service';
import {
  TranslationServiceUnavailableError,
  TranslationTimeoutError,
  TranslationError,
} from '../../src/domain/errors';

// Mock the @google/genai module
jest.mock('@google/genai');

describe('GeminiTranslationService', () => {
  let service: GeminiTranslationService;
  let mockGenAI: any;

  beforeEach(() => {
    // Set up mock environment variable
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.GEMINI_MODEL = 'gemini-2.0-flash-001';
    process.env.TRANSLATION_TIMEOUT_MS = '30000';

    // Reset mocks before each test
    jest.clearAllMocks();

    // Create mock Gemini client
    mockGenAI = {
      models: {
        generateContent: jest.fn(),
        countTokens: jest.fn(),
      },
    };

    // Mock the GoogleGenAI constructor
    const { GoogleGenAI } = require('@google/genai');
    (GoogleGenAI as jest.Mock).mockImplementation(() => mockGenAI);

    service = new GeminiTranslationService();
  });

  describe('translateText', () => {
    it('should successfully translate a single item', async () => {
      // Arrange
      const mockResponse = {
        text: 'Bonjour, le monde!',
      };
      mockGenAI.models.generateContent.mockResolvedValue(mockResponse);

      // Act
      const result = await service.translateText('Hello, world!', 'en', 'fr');

      // Assert
      expect(result).toBe('Bonjour, le monde!');
      expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(1);
    });

    it('should successfully translate multiple items in a batch', async () => {
      // Arrange
      const texts = ['Hello', 'World', 'Test'];
      const translations = ['Bonjour', 'Monde', 'Test'];

      mockGenAI.models.generateContent
        .mockResolvedValueOnce({ text: translations[0] })
        .mockResolvedValueOnce({ text: translations[1] })
        .mockResolvedValueOnce({ text: translations[2] });

      // Act
      const results = await Promise.all(
        texts.map(text => service.translateText(text, 'en', 'fr'))
      );

      // Assert
      expect(results).toEqual(translations);
      expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(3);
    });

    it('should handle Gemini API errors gracefully', async () => {
      // Arrange
      mockGenAI.models.generateContent.mockRejectedValue(
        new Error('API Error: Invalid request')
      );

      // Act & Assert
      await expect(service.translateText('Hello', 'en', 'fr')).rejects.toThrow(
        TranslationError
      );
    });

    it('should retry on transient failures (429 rate limit)', async () => {
      // Arrange
      const rateLimitError = new Error('429: Rate limit exceeded');
      (rateLimitError as any).status = 429;

      mockGenAI.models.generateContent
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ text: 'Bonjour' });

      // Act
      const result = await service.translateText('Hello', 'en', 'fr');

      // Assert
      expect(result).toBe('Bonjour');
      expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(2);
    });

    it('should retry on server errors (503)', async () => {
      // Arrange
      const serverError = new Error('503: Service unavailable');
      (serverError as any).status = 503;

      mockGenAI.models.generateContent
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({ text: 'Bonjour' });

      // Act
      const result = await service.translateText('Hello', 'en', 'fr');

      // Assert
      expect(result).toBe('Bonjour');
      expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(2);
    });

    it('should not retry on permanent failures (400 bad request)', async () => {
      // Arrange
      const badRequestError = new Error('400: Bad request');
      (badRequestError as any).status = 400;

      mockGenAI.models.generateContent.mockRejectedValue(badRequestError);

      // Act & Assert
      await expect(service.translateText('Hello', 'en', 'fr')).rejects.toThrow(
        TranslationError
      );
      expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(1); // No retry
    });

    it('should not retry on auth failures (401 unauthorized)', async () => {
      // Arrange
      const authError = new Error('401: Unauthorized');
      (authError as any).status = 401;

      mockGenAI.models.generateContent.mockRejectedValue(authError);

      // Act & Assert
      await expect(service.translateText('Hello', 'en', 'fr')).rejects.toThrow(
        TranslationServiceUnavailableError
      );
      expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(1); // No retry
    });
  });

  describe('countTokens', () => {
    it('should return token count for text', async () => {
      // Arrange
      mockGenAI.models.countTokens.mockResolvedValue({ totalTokens: 150 });

      // Act
      const count = await service.countTokens('Hello, world! This is a test.');

      // Assert
      expect(count).toBe(150);
      expect(mockGenAI.models.countTokens).toHaveBeenCalledTimes(1);
    });

    it('should handle token counting errors', async () => {
      // Arrange
      mockGenAI.models.countTokens.mockRejectedValue(new Error('API Error'));

      // Act & Assert
      await expect(
        service.countTokens('Hello, world!')
      ).rejects.toThrow(TranslationError);
    });
  });
});
