# Quickstart Guide: Text Translation API

**Feature**: Text Translation API
**Branch**: 002-api-translate-at
**Last Updated**: 2025-10-16

## Overview

This guide will help you get started with the Text Translation API, which allows you to translate batches of text items from one language to another while preserving structure and metadata.

## Prerequisites

- Node.js 20.x or higher
- npm or yarn package manager
- Google Gemini API key (free tier available)
- Basic understanding of REST APIs and JSON

## Setup

### 1. Install Dependencies

```bash
npm install @google/genai iso-639-1 exponential-backoff
```

### 2. Configure Environment

Create or update your `.env` file in the project root:

```env
# Google Gemini API Configuration
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.0-flash-001
TRANSLATION_TIMEOUT_MS=30000
GEMINI_RATE_LIMIT_RPM=5

# Server Configuration (existing)
PORT=3000
NODE_ENV=development
```

**Getting a Gemini API Key**:
1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy the key and add it to your `.env` file

### 3. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## Quick Examples

### Example 1: Basic Translation

Translate two English text items to French:

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/translate \
  -H "Content-Type: application/json" \
  -d '{
    "sourceLanguage": "en",
    "targetLanguage": "fr",
    "items": [
      {
        "id": "item-1",
        "text": "Hello, world!",
        "position": { "page": 1, "x": 100, "y": 200 }
      },
      {
        "id": "item-2",
        "text": "This is a test.",
        "position": { "page": 1, "x": 100, "y": 250 }
      }
    ]
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Text translated successfully.",
  "data": [
    {
      "id": "item-1",
      "text": "Bonjour, le monde!",
      "position": { "page": 1, "x": 100, "y": 200 }
    },
    {
      "id": "item-2",
      "text": "Ceci est un test.",
      "position": { "page": 1, "x": 100, "y": 250 }
    }
  ]
}
```

### Example 2: Spanish to German

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/translate \
  -H "Content-Type: application/json" \
  -d '{
    "sourceLanguage": "es",
    "targetLanguage": "de",
    "items": [
      {
        "id": "greeting",
        "text": "Hola, ¿cómo estás?",
        "position": { "page": 1, "x": 50, "y": 100 }
      }
    ]
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Text translated successfully.",
  "data": [
    {
      "id": "greeting",
      "text": "Hallo, wie geht es dir?",
      "position": { "page": 1, "x": 50, "y": 100 }
    }
  ]
}
```

### Example 3: JavaScript/TypeScript Client

```typescript
interface Position {
  page: number;
  x: number;
  y: number;
}

interface TextItem {
  id: string;
  text: string;
  position: Position;
}

interface TranslateRequest {
  sourceLanguage: string;
  targetLanguage: string;
  items: TextItem[];
}

interface TranslateResponse {
  success: boolean;
  message: string;
  data: TextItem[];
}

async function translateText(
  sourceLanguage: string,
  targetLanguage: string,
  items: TextItem[]
): Promise<TextItem[]> {
  const response = await fetch('http://localhost:3000/api/v1/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sourceLanguage,
      targetLanguage,
      items,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const result: TranslateResponse = await response.json();
  return result.data;
}

// Usage
const items: TextItem[] = [
  {
    id: 'title',
    text: 'Welcome to our application',
    position: { page: 1, x: 100, y: 50 },
  },
  {
    id: 'subtitle',
    text: 'Getting started is easy',
    position: { page: 1, x: 100, y: 80 },
  },
];

translateText('en', 'es', items)
  .then(translated => {
    console.log('Translated items:', translated);
  })
  .catch(error => {
    console.error('Translation failed:', error.message);
  });
```

## Supported Languages

The API supports 100+ languages via Google Gemini. Common language codes include:

| Code | Language | Code | Language | Code | Language |
|------|----------|------|----------|------|----------|
| en | English | es | Spanish | fr | French |
| de | German | it | Italian | pt | Portuguese |
| ru | Russian | ja | Japanese | ko | Korean |
| zh | Chinese | ar | Arabic | hi | Hindi |
| nl | Dutch | sv | Swedish | pl | Polish |

**Full List**: Use the `/languages` endpoint (coming soon) or see [ISO 639-1 codes](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes).

## Error Handling

### Common Errors

#### 400 Bad Request - Invalid Language

**Scenario**: Using an invalid language code

**Request**:
```json
{
  "sourceLanguage": "xyz",
  "targetLanguage": "fr",
  "items": [...]
}
```

**Response**:
```json
{
  "success": false,
  "message": "Invalid language code provided.",
  "error": {
    "code": "INVALID_LANGUAGE",
    "details": {
      "field": "sourceLanguage",
      "value": "xyz"
    }
  }
}
```

#### 413 Payload Too Large - Token Limit Exceeded

**Scenario**: Total text content exceeds 10,000 tokens

**Response**:
```json
{
  "success": false,
  "message": "Text content exceeds the 10,000 token limit.",
  "error": {
    "code": "TOKEN_LIMIT_EXCEEDED",
    "details": {
      "actualTokens": 12500,
      "maxTokens": 10000
    }
  }
}
```

#### 503 Service Unavailable

**Scenario**: Google Gemini API is temporarily unavailable

**Response**:
```json
{
  "success": false,
  "message": "Translation service is temporarily unavailable.",
  "error": {
    "code": "TRANSLATION_SERVICE_UNAVAILABLE"
  }
}
```

### Error Handling Best Practices

```typescript
async function translateWithRetry(
  sourceLanguage: string,
  targetLanguage: string,
  items: TextItem[],
  maxRetries = 3
): Promise<TextItem[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await translateText(sourceLanguage, targetLanguage, items);
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError;
}
```

## Rate Limits

### Free Tier (Google AI Studio)
- **5 requests per minute (RPM)**
- **25 requests per day (RPD)**
- **32,000 tokens per minute (TPM)**

### Paid Tier (Gemini 1.5 Flash)
- **1,000 requests per minute (RPM)**
- **Unlimited requests per day**
- **Higher token limits**

### Handling Rate Limits

When you hit rate limits, the API will return a 429 status code. Implement client-side rate limiting:

```typescript
import pLimit from 'p-limit';

// Limit to 5 concurrent requests (free tier)
const limit = pLimit(5);

const promises = batches.map(batch =>
  limit(() => translateText('en', 'fr', batch))
);

const results = await Promise.all(promises);
```

## Performance Tips

### 1. Batch Efficiently

**Good**: Batch multiple items in a single request
```json
{
  "items": [
    { "id": "1", "text": "Hello" },
    { "id": "2", "text": "World" },
    { "id": "3", "text": "Test" }
  ]
}
```

**Bad**: Making separate requests for each item
```json
// Request 1
{ "items": [{ "id": "1", "text": "Hello" }] }
// Request 2
{ "items": [{ "id": "2", "text": "World" }] }
// Request 3
{ "items": [{ "id": "3", "text": "Test" }] }
```

### 2. Stay Under Token Limits

- Aim for ~8,000 tokens per request to leave headroom
- Split large documents into multiple requests
- Use shorter text items when possible

### 3. Monitor Response Times

- Simple translations: 1-3 seconds
- Complex translations: 5-10 seconds
- Very large batches: up to 30 seconds

## Testing

### Manual Testing with curl

```bash
# Save request to file
cat > request.json <<EOF
{
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "items": [
    {
      "id": "test-1",
      "text": "The quick brown fox jumps over the lazy dog.",
      "position": { "page": 1, "x": 0, "y": 0 }
    }
  ]
}
EOF

# Send request
curl -X POST http://localhost:3000/api/v1/translate \
  -H "Content-Type: application/json" \
  -d @request.json | jq
```

### Automated Testing

Run the integration tests:

```bash
npm test -- translation-api.integration.test.ts
```

## Troubleshooting

### API Key Not Found

**Error**: `GEMINI_API_KEY environment variable not set`

**Solution**: Ensure `.env` file contains `GEMINI_API_KEY=your_key_here` and restart the server.

### Invalid API Key

**Error**: `401 Unauthorized` from Gemini API

**Solution**: Verify your API key is correct and active at [Google AI Studio](https://aistudio.google.com/apikey).

### Slow Responses

**Issue**: Translations taking longer than expected

**Solutions**:
- Check your network connection
- Verify you're on a stable internet connection
- Consider using a paid tier for higher rate limits
- Reduce batch sizes to stay under token limits

### Translation Quality Issues

**Issue**: Translations don't match expectations

**Solutions**:
- Ensure source language is correctly specified
- Use more context in text items (full sentences vs. fragments)
- Check for special characters or formatting that may confuse the model
- Consider adding context or instructions in future versions

## Next Steps

- **API Documentation**: See [api.openapi.yaml](./contracts/api.openapi.yaml) for full API specification
- **Data Model**: Review [data-model.md](./data-model.md) for entity definitions
- **Implementation**: See [plan.md](./plan.md) for development roadmap
- **Testing**: Run integration tests with `npm test`

## Support

For issues or questions:
- Check the [API specification](./contracts/api.openapi.yaml)
- Review error codes in [data-model.md](./data-model.md)
- Open an issue on the project repository
