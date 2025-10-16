import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TranslateTextUseCase } from '../../src/application/use-cases/translate-text.use-case';
import { ITranslationService } from '../../src/application/interfaces/translation.interface';
import { TranslationItem } from '../../src/domain/entities/translation-item.entity';
import { InvalidLanguageError, TokenLimitExceededError } from '../../src/domain/errors';

describe('TranslateTextUseCase', () => {
  let useCase: TranslateTextUseCase;
  let mockTranslationService: jest.Mocked<ITranslationService>;

  beforeEach(() => {
    // Create mock translation service
    mockTranslationService = {
      translateText: jest.fn(),
      countTokens: jest.fn(),
    } as jest.Mocked<ITranslationService>;

    useCase = new TranslateTextUseCase(mockTranslationService);
  });

  describe('execute', () => {
    it('should orchestrate translation of valid request', async () => {
      // Arrange
      const items: TranslationItem[] = [
        new TranslationItem('item-1', 'Hello', { page: 1, x: 100, y: 200 }),
        new TranslationItem('item-2', 'World', { page: 1, x: 100, y: 250 }),
      ];

      mockTranslationService.countTokens.mockResolvedValue(50); // Total tokens
      mockTranslationService.translateText
        .mockResolvedValueOnce('Bonjour')
        .mockResolvedValueOnce('Monde');

      // Act
      const result = await useCase.execute('en', 'fr', items);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('item-1');
      expect(result[0].text).toBe('Bonjour');
      expect(result[0].position).toEqual({ page: 1, x: 100, y: 200 });
      expect(result[1].id).toBe('item-2');
      expect(result[1].text).toBe('Monde');
      expect(result[1].position).toEqual({ page: 1, x: 100, y: 250 });
    });

    it('should preserve item IDs through translation', async () => {
      // Arrange
      const items: TranslationItem[] = [
        new TranslationItem('custom-id-123', 'Hello', { page: 1, x: 0, y: 0 }),
      ];

      mockTranslationService.countTokens.mockResolvedValue(10);
      mockTranslationService.translateText.mockResolvedValue('Bonjour');

      // Act
      const result = await useCase.execute('en', 'fr', items);

      // Assert
      expect(result[0].id).toBe('custom-id-123');
    });

    it('should preserve position metadata through translation', async () => {
      // Arrange
      const items: TranslationItem[] = [
        new TranslationItem('item-1', 'Hello', { page: 5, x: 250.5, y: 100.75 }),
      ];

      mockTranslationService.countTokens.mockResolvedValue(10);
      mockTranslationService.translateText.mockResolvedValue('Bonjour');

      // Act
      const result = await useCase.execute('en', 'fr', items);

      // Assert
      expect(result[0].position).toEqual({ page: 5, x: 250.5, y: 100.75 });
    });

    it('should call translation service with correct parameters', async () => {
      // Arrange
      const items: TranslationItem[] = [
        new TranslationItem('item-1', 'Hello, world!', { page: 1, x: 0, y: 0 }),
      ];

      mockTranslationService.countTokens.mockResolvedValue(10);
      mockTranslationService.translateText.mockResolvedValue('Bonjour, le monde!');

      // Act
      await useCase.execute('en', 'es', items);

      // Assert
      expect(mockTranslationService.translateText).toHaveBeenCalledWith(
        'Hello, world!',
        'en',
        'es'
      );
    });

    it('should validate that source and target languages are different', async () => {
      // Arrange
      const items: TranslationItem[] = [
        new TranslationItem('item-1', 'Hello', { page: 1, x: 0, y: 0 }),
      ];

      // Act & Assert
      await expect(useCase.execute('en', 'en', items)).rejects.toThrow(
        InvalidLanguageError
      );
      await expect(useCase.execute('en', 'en', items)).rejects.toThrow(
        'Source and target languages must be different'
      );
    });

    it('should validate that items array is not empty', async () => {
      // Act & Assert
      await expect(useCase.execute('en', 'fr', [])).rejects.toThrow(
        'Items array cannot be empty'
      );
    });

    it('should validate token limit (10,000 tokens)', async () => {
      // Arrange
      const items: TranslationItem[] = [
        new TranslationItem('item-1', 'Very long text...', { page: 1, x: 0, y: 0 }),
      ];

      mockTranslationService.countTokens.mockResolvedValue(10001); // Exceeds limit

      // Act & Assert
      await expect(useCase.execute('en', 'fr', items)).rejects.toThrow(
        TokenLimitExceededError
      );
    });

    it('should accept requests with exactly 10,000 tokens', async () => {
      // Arrange
      const items: TranslationItem[] = [
        new TranslationItem('item-1', 'Long text...', { page: 1, x: 0, y: 0 }),
      ];

      mockTranslationService.countTokens.mockResolvedValue(10000); // At limit
      mockTranslationService.translateText.mockResolvedValue('Texte long...');

      // Act
      const result = await useCase.execute('en', 'fr', items);

      // Assert
      expect(result).toHaveLength(1);
    });

    it('should validate that all item IDs are unique', async () => {
      // Arrange
      const items: TranslationItem[] = [
        new TranslationItem('duplicate-id', 'Hello', { page: 1, x: 0, y: 0 }),
        new TranslationItem('duplicate-id', 'World', { page: 1, x: 0, y: 100 }),
      ];

      mockTranslationService.countTokens.mockResolvedValue(20);

      // Act & Assert
      await expect(useCase.execute('en', 'fr', items)).rejects.toThrow(
        'All item IDs must be unique'
      );
    });

    it('should handle multiple items and maintain order', async () => {
      // Arrange
      const items: TranslationItem[] = [
        new TranslationItem('first', 'First', { page: 1, x: 0, y: 0 }),
        new TranslationItem('second', 'Second', { page: 1, x: 0, y: 50 }),
        new TranslationItem('third', 'Third', { page: 1, x: 0, y: 100 }),
      ];

      mockTranslationService.countTokens.mockResolvedValue(30);
      mockTranslationService.translateText
        .mockResolvedValueOnce('Premier')
        .mockResolvedValueOnce('Deuxième')
        .mockResolvedValueOnce('Troisième');

      // Act
      const result = await useCase.execute('en', 'fr', items);

      // Assert
      expect(result[0].id).toBe('first');
      expect(result[0].text).toBe('Premier');
      expect(result[1].id).toBe('second');
      expect(result[1].text).toBe('Deuxième');
      expect(result[2].id).toBe('third');
      expect(result[2].text).toBe('Troisième');
    });
  });
});
