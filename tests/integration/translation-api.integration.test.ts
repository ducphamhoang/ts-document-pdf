import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { createTranslationRoutes } from '../../src/presentation/routes/translation.routes';
import { errorMiddleware } from '../../src/presentation/middleware/error.middleware';

// Mock the Gemini SDK
jest.mock('@google/genai');

describe('Translation API Integration Tests', () => {
  let app: Express;
  let mockGenAI: any;

  beforeAll(async () => {
    // Set up environment variables
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.GEMINI_MODEL = 'gemini-2.0-flash-001';
    process.env.TRANSLATION_TIMEOUT_MS = '30000';

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

    // Initialize express app with translation routes
    app = express();
    app.use(express.json());
    app.use('/api/v1', createTranslationRoutes());
    app.use(errorMiddleware);
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Default mock responses
    mockGenAI.models.generateContent.mockResolvedValue({
      text: 'Bonjour, le monde!',
    });
    mockGenAI.models.countTokens.mockResolvedValue({ totalTokens: 100 });
  });

  afterAll(async () => {
    // Cleanup environment variables
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.TRANSLATION_TIMEOUT_MS;
  });

  describe('POST /api/v1/translate', () => {
    it('should translate English to French with 2 items', async () => {
      // Arrange
      mockGenAI.models.generateContent
        .mockResolvedValueOnce({ text: 'Bonjour, le monde!' })
        .mockResolvedValueOnce({ text: "C'est un test." });

      const requestBody = {
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        items: [
          {
            id: 'item-1',
            text: 'Hello, world!',
            position: { page: 1, x: 100, y: 200 },
          },
          {
            id: 'item-2',
            text: 'This is a test.',
            position: { page: 1, x: 100, y: 250 },
          },
        ],
      };

      // Act
      const response = await request(app)
        .post('/api/v1/translate')
        .send(requestBody)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Text translated successfully.');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('item-1');
      expect(response.body.data[0].text).toContain('Bonjour'); // Should be French
      expect(response.body.data[0].position).toEqual({ page: 1, x: 100, y: 200 });
      expect(response.body.data[1].id).toBe('item-2');
      expect(response.body.data[1].position).toEqual({ page: 1, x: 100, y: 250 });
    });

    it('should preserve all IDs and positions through translation', async () => {
      // Arrange
      mockGenAI.models.generateContent.mockResolvedValueOnce({ text: 'Bienvenido' });

      const requestBody = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        items: [
          {
            id: 'custom-id-123',
            text: 'Welcome',
            position: { page: 5, x: 250.5, y: 100.75 },
          },
        ],
      };

      // Act
      const response = await request(app)
        .post('/api/v1/translate')
        .send(requestBody)
        .expect(200);

      // Assert
      expect(response.body.data[0].id).toBe('custom-id-123');
      expect(response.body.data[0].position).toEqual({ page: 5, x: 250.5, y: 100.75 });
    });

    it('should complete standard payload (10 items, ~1000 tokens) in under 3 seconds', async () => {
      // Arrange
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i + 1}`,
        text: 'The quick brown fox jumps over the lazy dog. This is a test sentence.',
        position: { page: 1, x: 100, y: 100 + i * 20 },
      }));

      const requestBody = {
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        items,
      };

      const startTime = Date.now();

      // Act
      const response = await request(app)
        .post('/api/v1/translate')
        .send(requestBody)
        .expect(200);

      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(3000); // Under 3 seconds
      expect(response.body.data).toHaveLength(10);
    });

    it('should handle special characters and formatting', async () => {
      // Arrange
      const requestBody = {
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        items: [
          {
            id: 'special-1',
            text: 'Hello! How are you? I\'m fine, thanks.',
            position: { page: 1, x: 0, y: 0 },
          },
          {
            id: 'special-2',
            text: 'Price: $19.99 (20% off)',
            position: { page: 1, x: 0, y: 50 },
          },
        ],
      };

      // Act
      const response = await request(app)
        .post('/api/v1/translate')
        .send(requestBody)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      // Translations should preserve punctuation and structure
    });

    it('should handle concurrent requests (10 parallel)', async () => {
      // Arrange
      const createRequest = (id: number) => ({
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        items: [
          {
            id: `concurrent-${id}`,
            text: `Test message ${id}`,
            position: { page: 1, x: 0, y: 0 },
          },
        ],
      });

      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app).post('/api/v1/translate').send(createRequest(i))
      );

      // Act
      const responses = await Promise.all(requests);

      // Assert
      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data[0].id).toBe(`concurrent-${i}`);
      });
    });

    it('should return 400 for invalid language code', async () => {
      // Arrange
      const requestBody = {
        sourceLanguage: 'xyz', // Invalid
        targetLanguage: 'fr',
        items: [
          {
            id: 'item-1',
            text: 'Hello',
            position: { page: 1, x: 0, y: 0 },
          },
        ],
      };

      // Act
      const response = await request(app)
        .post('/api/v1/translate')
        .send(requestBody)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_REQUEST');
      expect(response.body.message).toContain('Validation failed');
    });

    it('should return 400 for empty items array', async () => {
      // Arrange
      const requestBody = {
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        items: [],
      };

      // Act
      const response = await request(app)
        .post('/api/v1/translate')
        .send(requestBody)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
      expect(response.body.error.code).toBe('INVALID_REQUEST');
    });

    it('should return 400 for same source and target language', async () => {
      // Arrange
      const requestBody = {
        sourceLanguage: 'en',
        targetLanguage: 'en',
        items: [
          {
            id: 'item-1',
            text: 'Hello',
            position: { page: 1, x: 0, y: 0 },
          },
        ],
      };

      // Act
      const response = await request(app)
        .post('/api/v1/translate')
        .send(requestBody)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
    });

    it('should return 500 for malformed JSON', async () => {
      // Act - Express returns 500 for JSON parse errors by default
      const response = await request(app)
        .post('/api/v1/translate')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(500);

      // Assert
      expect(response.body.success).toBe(false);
    });

    it('should return 413 when text content exceeds 10,000 tokens', async () => {
      // Arrange
      mockGenAI.models.countTokens.mockResolvedValueOnce({ totalTokens: 15000 }); // Over limit

      const longText = 'word '.repeat(5000); // Approximately >10k tokens
      const requestBody = {
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        items: [
          {
            id: 'long-item',
            text: longText,
            position: { page: 1, x: 0, y: 0 },
          },
        ],
      };

      // Act
      const response = await request(app)
        .post('/api/v1/translate')
        .send(requestBody)
        .expect(413);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_LIMIT_EXCEEDED');
      expect(response.body.error.details).toHaveProperty('actualTokens');
      expect(response.body.error.details).toHaveProperty('maxTokens');
    });
  });
});
