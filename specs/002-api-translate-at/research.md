# Research: Text Translation API Feature

**Feature**: Text Translation API with Google Gemini
**Branch**: `002-api-translate-at`
**Date**: 2025-10-16

## Overview

This document consolidates research findings for implementing the Text Translation API feature using Google Gemini AI. The research addresses the Google Generative AI SDK selection, token counting implementation, error handling strategies, language code validation, and best practices for AI service integration.

---

## 1. Google Generative AI SDK for Node.js

### Decision: Use `@google/genai` (Unified SDK)

### Rationale

Google has released a new unified SDK that supersedes the legacy `@google/generative-ai` package. The new SDK provides:

1. **Future-proof**: Active development and feature updates (v1.25.0 as of Oct 2025)
2. **Unified architecture**: Single client object for all services (models, files, caches)
3. **Better support**: Legacy SDK support ends August 31, 2025
4. **Latest features**: Access to Gemini 2.0+ capabilities
5. **Dual platform**: Works with both Google AI Studio API and Vertex AI

### Package Information

- **Package name**: `@google/genai`
- **Latest version**: 1.25.0 (actively maintained)
- **Installation**: `npm i @google/genai`
- **Weekly downloads**: Used by 590+ projects
- **Documentation**: https://googleapis.github.io/js-genai/

### Basic Usage Pattern

```typescript
import { GoogleGenAI } from '@google/genai';

// Initialize with API key (from environment variable)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Generate content
const response = await ai.models.generateContent({
  model: 'gemini-2.0-flash-001',
  contents: 'Translate the following text from English to French: Hello, world!'
});

console.log(response.text);
```

### API Key Configuration

**Option 1: Explicit API key**
```typescript
const ai = new GoogleGenAI({ apiKey: 'YOUR_API_KEY' });
```

**Option 2: Environment variable (recommended)**
```typescript
// SDK automatically picks up from GEMINI_API_KEY or GOOGLE_API_KEY
const ai = new GoogleGenAI({});
```

**Option 3: For Vertex AI**
```typescript
const ai = new GoogleGenAI({
  vertexai: true,
  project: 'your-project-id',
  location: 'us-central1'
});
```

### Configuration Options

- **API Version**: Defaults to beta, can specify `apiVersion: 'v1'` for stable endpoints
- **Error Handling**: Provides `ApiError` class with `name`, `message`, and `status` properties
- **Model Selection**: Supports various models (gemini-2.0-flash-001, gemini-1.5-pro, etc.)

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **@google/generative-ai** | Legacy package, support ends August 2025, missing Gemini 2.0 features |
| **OpenAI API** | Different pricing model, requires different integration, Gemini is free tier-friendly |
| **Google Cloud Translation API** | Separate API, requires GCP setup, less flexible for custom prompts |
| **Custom ML model** | Requires training data, infrastructure, expertise; overkill for MVP |

### Migration Notes

If migrating from legacy SDK:

| Old SDK | New SDK |
|---------|---------|
| `new GoogleGenerativeAI(apiKey)` | `new GoogleGenAI({apiKey})` |
| `genAI.getGenerativeModel({model})` | `ai.models.generateContent({model})` |
| Separate file/cache managers | Unified `ai.files.*` and `ai.caches.*` |

---

## 2. Token Counting Implementation

### Decision: Use built-in `models.countTokens()` method

### Rationale

The `@google/genai` SDK provides a native token counting method that:

1. **Accurate**: Uses the same tokenizer as the model
2. **Free**: No charge for countTokens API calls
3. **Fast**: High quota (3000 requests per minute)
4. **Multimodal**: Supports text, images, video, audio
5. **Pre-validation**: Count tokens before making expensive generateContent calls

### Implementation Pattern

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function countTokens(text: string): Promise<number> {
  const response = await ai.models.countTokens({
    model: 'gemini-2.0-flash-001',
    contents: text
  });

  return response.totalTokens;
}

// Usage example
const text = "Long document content...";
const tokenCount = await countTokens(text);

if (tokenCount > 10000) {
  throw new Error(`Text exceeds 10,000 token limit (${tokenCount} tokens)`);
}
```

### Token Count Guidelines

- **Token to character ratio**: ~4 characters per token
- **Token to word ratio**: 100 tokens ≈ 60-80 English words
- **Limit**: 10,000 tokens (enforced in validation layer)

### Return Type

```typescript
interface CountTokensResponse {
  totalTokens: number;
  // Additional metadata may be available
}
```

### Post-Generation Token Tracking

After translation, you can also check actual token usage:

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.0-flash-001',
  contents: prompt
});

// Check usage metadata
console.log(response.usageMetadata);
// {
//   promptTokens: 150,
//   candidatesTokens: 200,
//   totalTokens: 350
// }
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **tiktoken library** | OpenAI-specific tokenizer, not compatible with Gemini models |
| **Character/word count approximation** | Inaccurate, different languages have different token densities |
| **gpt-tokenizer npm** | Wrong tokenizer for Gemini, would give incorrect counts |
| **No validation** | User experience suffers, API calls fail unexpectedly |

### Best Practices

1. **Pre-validation**: Count tokens before translation to fail fast
2. **Clear error messages**: Tell users exactly how many tokens over the limit
3. **Caching**: Cache token counts for identical text (if applicable)
4. **Buffer**: Consider a 9,500 token limit to leave room for prompt overhead

---

## 3. Translation Prompt Engineering

### Decision: Use natural language prompts with structured JSON output

### Rationale

Google Gemini excels at following natural language instructions and can produce structured JSON output. This approach provides:

1. **Flexibility**: Easy to adjust translation style/tone
2. **Context awareness**: Can specify domain-specific requirements
3. **Structured output**: JSON format for easy parsing
4. **Language support**: Gemini supports 100+ languages natively

### Prompt Template

```typescript
function buildTranslationPrompt(text: string, sourceLanguage: string, targetLanguage: string): string {
  return `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}.

Requirements:
- Preserve the original meaning, tone, and style
- Maintain any formatting or structure
- Keep proper nouns unchanged unless they have standard translations
- Use natural, fluent language in the target language

Text to translate:
${text}

Provide the translation as a JSON object with this structure:
{
  "translatedText": "the translated text here",
  "sourceLanguage": "${sourceLanguage}",
  "targetLanguage": "${targetLanguage}"
}`;
}
```

### Complete Translation Function

```typescript
async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = buildTranslationPrompt(text, sourceLanguage, targetLanguage);

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-001',
    contents: prompt
  });

  const result = JSON.parse(response.text);
  return result.translatedText;
}
```

### Language Code Format

Gemini accepts both:
- **ISO 639-1 codes**: "en", "fr", "es" (recommended for API)
- **Language names**: "English", "French", "Spanish" (used in prompts)

For prompts, use full language names for clarity:
- `ISO6391.getName('en')` → "English"
- `ISO6391.getName('fr')` → "French"

### Alternative Prompt Strategies

**Concise prompt** (faster, less tokens):
```typescript
`Translate from ${sourceLanguage} to ${targetLanguage}: ${text}`
```

**JSON-first approach**:
```typescript
`Translate in ${targetLanguage} the text in input. Use json template in output and replace RESULT by the translation.`
```

### Best Practices

1. **Consistent format**: Always request JSON output for parsing reliability
2. **Language names**: Use full names in prompts ("English" not "en")
3. **Clear instructions**: Specify tone, style, domain if needed
4. **Error handling**: Wrap JSON.parse in try-catch for malformed responses
5. **Validation**: Verify response contains expected fields before returning

### Known Limitations

- Occasional inconsistencies (rare cases of wrong target language)
- May need retry logic for malformed JSON responses
- Very long texts may lose context (use chunking if needed)

---

## 4. Error Handling and Retry Strategies

### Decision: Exponential backoff with retry for transient failures

### Rationale

AI APIs can experience transient failures (rate limits, timeouts, temporary unavailability). A robust retry strategy ensures:

1. **Resilience**: Automatic recovery from temporary issues
2. **User experience**: Fewer failed requests
3. **Best practice**: Industry standard for API reliability
4. **Rate limit compliance**: Exponential backoff prevents thundering herd

### Recommended Package: `exponential-backoff`

- **Package**: `exponential-backoff`
- **Weekly downloads**: 325,338
- **Latest version**: Latest stable
- **Installation**: `npm i exponential-backoff`

### Implementation Pattern

```typescript
import { backOff } from 'exponential-backoff';
import { GoogleGenAI } from '@google/genai';

async function translateWithRetry(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  return await backOff(
    async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: buildTranslationPrompt(text, sourceLanguage, targetLanguage)
      });

      return response.text;
    },
    {
      numOfAttempts: 3,
      startingDelay: 1000,      // 1 second
      timeMultiple: 2,           // Double delay each retry
      maxDelay: 10000,           // Max 10 seconds
      jitter: 'full',            // Add randomness to prevent thundering herd
      retry: (error: any) => {
        // Retry on these conditions
        if (error.status === 429) return true;  // Rate limit
        if (error.status >= 500) return true;   // Server errors
        if (error.code === 'ETIMEDOUT') return true;  // Timeout
        return false;  // Don't retry client errors (400-499)
      }
    }
  );
}
```

### Error Categories and Handling

| Error Type | HTTP Status | Retry? | Action |
|------------|-------------|--------|--------|
| **Rate limit** | 429 | Yes | Exponential backoff, max 3 retries |
| **Server error** | 500-599 | Yes | Retry with backoff |
| **Timeout** | 504 | Yes | Retry, consider increasing timeout |
| **Invalid API key** | 401 | No | Return error immediately, check config |
| **Invalid request** | 400 | No | Return error, fix request parameters |
| **Token limit exceeded** | 400 | No | Return error, text too long |
| **Network error** | - | Yes | Retry, check connectivity |

### Custom Error Classes

```typescript
// Domain errors
class TranslationError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'TranslationError';
  }
}

class TokenLimitExceededError extends TranslationError {
  constructor(tokenCount: number, limit: number) {
    super(`Text exceeds token limit: ${tokenCount}/${limit} tokens`);
    this.name = 'TokenLimitExceededError';
  }
}

class RateLimitError extends TranslationError {
  constructor() {
    super('Translation service rate limit exceeded, please try again later');
    this.name = 'RateLimitError';
  }
}

class InvalidLanguageError extends TranslationError {
  constructor(languageCode: string) {
    super(`Invalid language code: ${languageCode}`);
    this.name = 'InvalidLanguageError';
  }
}
```

### Retry Configuration Recommendations

**Development/Testing**:
- Attempts: 2
- Starting delay: 500ms
- Max delay: 2000ms

**Production**:
- Attempts: 3
- Starting delay: 1000ms
- Max delay: 10000ms
- Jitter: full (prevents thundering herd)

**Heavy load environments**:
- Attempts: 4
- Starting delay: 2000ms
- Max delay: 30000ms
- Circuit breaker pattern (stop retrying after N failures)

### Alternative Retry Packages

| Package | Pros | Cons |
|---------|------|------|
| **exponential-backoff** | Simple API, widely used, supports jitter | - |
| **p-retry** | Promise-based, AbortController support | Slightly more complex |
| **retry** | Very configurable, event-based | More boilerplate code |
| **axios-retry** | Axios-specific, zero config | Couples to axios library |

### Logging Best Practices

```typescript
import logger from '@infrastructure/logger';

async function translateWithRetry(text: string, source: string, target: string): Promise<string> {
  logger.info('Translation started', { source, target, textLength: text.length });

  try {
    const result = await backOff(
      async () => {
        // Translation logic
      },
      {
        retry: (error, attemptNumber) => {
          logger.warn('Translation retry', {
            attempt: attemptNumber,
            error: error.message
          });
          return shouldRetry(error);
        }
      }
    );

    logger.info('Translation completed', { source, target });
    return result;
  } catch (error) {
    logger.error('Translation failed', { source, target, error });
    throw new TranslationError('Translation failed after retries', error);
  }
}
```

---

## 5. Language Code Validation

### Decision: Use `iso-639-1` npm package for validation

### Rationale

Language codes must be validated to:

1. **Prevent errors**: Invalid codes cause API failures
2. **User feedback**: Provide clear error messages
3. **Security**: Prevent injection attacks via language parameters
4. **Standards compliance**: Use ISO 639-1 standard

### Package Information

- **Package**: `iso-639-1`
- **Latest version**: 3.1.5
- **Weekly downloads**: 325,338
- **Installation**: `npm i iso-639-1`
- **Standards**: ISO 639-1 (2-letter language codes)

### Usage Examples

```typescript
import ISO6391 from 'iso-639-1';

// Validate language code
function isValidLanguageCode(code: string): boolean {
  return ISO6391.validate(code);
}

// Get language name from code
function getLanguageName(code: string): string {
  return ISO6391.getName(code);
  // 'en' -> 'English'
  // 'fr' -> 'French'
  // 'es' -> 'Spanish'
}

// Get code from language name
function getLanguageCode(name: string): string {
  return ISO6391.getCode(name);
  // 'English' -> 'en'
  // 'French' -> 'fr'
}

// Get native name
function getNativeLanguageName(code: string): string {
  return ISO6391.getNativeName(code);
  // 'zh' -> '中文'
  // 'ja' -> '日本語'
}

// Get all codes
const allCodes = ISO6391.getAllCodes();
// ['aa', 'ab', ..., 'zu']

// Get all names
const allNames = ISO6391.getAllNames();
// ['Afar', 'Abkhaz', ..., 'Zulu']
```

### Validation Service Implementation

```typescript
import ISO6391 from 'iso-639-1';

class LanguageValidationService {
  validateLanguageCode(code: string): void {
    if (!code || typeof code !== 'string') {
      throw new InvalidLanguageError('Language code is required');
    }

    // Normalize to lowercase
    const normalizedCode = code.toLowerCase().trim();

    if (!ISO6391.validate(normalizedCode)) {
      throw new InvalidLanguageError(
        `Invalid language code: ${code}. Must be a valid ISO 639-1 code (e.g., 'en', 'fr', 'es').`
      );
    }
  }

  validateLanguagePair(sourceLanguage: string, targetLanguage: string): void {
    this.validateLanguageCode(sourceLanguage);
    this.validateLanguageCode(targetLanguage);

    if (sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) {
      throw new InvalidLanguageError('Source and target languages must be different');
    }
  }

  getLanguageName(code: string): string {
    this.validateLanguageCode(code);
    return ISO6391.getName(code.toLowerCase());
  }

  getSupportedLanguages(): Array<{ code: string; name: string }> {
    return ISO6391.getAllCodes().map(code => ({
      code,
      name: ISO6391.getName(code)
    }));
  }
}
```

### Language Code Format

ISO 639-1 uses 2-letter lowercase codes:
- ✅ `en`, `fr`, `es`, `de`, `ja`, `zh`
- ❌ `EN`, `eng`, `english`, `en-US`

For regional variants (not supported in ISO 639-1):
- Use `iso-639-1-plus` package
- Supports: `en-GB`, `pt-BR`, `zh-Hans`

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **iso-lang-codes** | Less popular, includes ISO 639-2 (3-letter codes) which we don't need |
| **iso-639-1-plus** | Good but adds regional variants complexity for MVP |
| **Manual validation** | Error-prone, requires maintaining language list |
| **No validation** | Fails at API call time with unclear errors |

### Best Practices

1. **Normalize input**: Always lowercase and trim
2. **Early validation**: Validate in request DTO/validation layer
3. **Clear errors**: Return list of supported languages in error message
4. **Case insensitive**: Accept "EN", "en", "En" but normalize to "en"
5. **Provide list**: Offer endpoint to list supported languages

### Supported Languages Endpoint

```typescript
// GET /api/v1/languages
router.get('/languages', (req, res) => {
  const languages = ISO6391.getAllCodes().map(code => ({
    code,
    name: ISO6391.getName(code),
    nativeName: ISO6391.getNativeName(code)
  }));

  res.json({
    success: true,
    languages,
    count: languages.length
  });
});
```

---

## 6. Rate Limiting and Quotas

### Decision: Implement client-side rate limiting + quota tracking

### Rationale

Google Gemini API has rate limits that vary by tier and model. Implementing client-side rate limiting:

1. **Prevents 429 errors**: Stay within quota proactively
2. **Better UX**: Queue requests instead of rejecting
3. **Cost control**: Track usage against limits
4. **Graceful degradation**: Handle peak loads

### Google Gemini API Rate Limits (2025)

**Free Tier**:
- Requests per minute (RPM): 5
- Requests per day (RPD): 25
- Tokens per minute (TPM): 32,000

**Gemini 1.5 Flash**:
- Requests per minute (RPM): 1,000
- Requests per day (RPD): Unlimited
- Tokens per minute (TPM): Higher limits

**Important Notes**:
- Limits are per project, not per API key
- RPD quotas reset at midnight Pacific time
- countTokens API has 3,000 RPM (separate quota)

### Rate Limiting Implementation

For MVP, basic rate limiting is sufficient:

```typescript
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 5, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Remove requests outside the time window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);

      logger.info(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      return this.waitForSlot();
    }

    this.requests.push(now);
  }
}

// Usage
const rateLimiter = new RateLimiter(5, 60000); // 5 requests per minute

async function translateWithRateLimit(text: string, source: string, target: string): Promise<string> {
  await rateLimiter.waitForSlot();
  return translateWithRetry(text, source, target);
}
```

### Alternative: Express Rate Limiting Middleware

For API-level rate limiting:

```typescript
import rateLimit from 'express-rate-limit';

const translationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per window per IP
  message: {
    success: false,
    error: {
      message: 'Too many translation requests, please try again later',
      type: 'RateLimitError'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/translate', translationRateLimiter, translateHandler);
```

### Configuration

```env
# .env
GEMINI_RATE_LIMIT_RPM=5
GEMINI_RATE_LIMIT_RPD=25
GEMINI_RATE_LIMIT_TPM=32000
```

```typescript
// config/index.ts
export const config = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY!,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-001',
    rateLimits: {
      requestsPerMinute: parseInt(process.env.GEMINI_RATE_LIMIT_RPM || '5', 10),
      requestsPerDay: parseInt(process.env.GEMINI_RATE_LIMIT_RPD || '25', 10),
      tokensPerMinute: parseInt(process.env.GEMINI_RATE_LIMIT_TPM || '32000', 10)
    }
  }
};
```

### Best Practices

1. **Monitoring**: Track API usage vs quotas
2. **Alerts**: Warn when approaching limits (80% threshold)
3. **Graceful degradation**: Queue requests or return 503 when at limit
4. **User feedback**: Tell users when rate limited and when to retry
5. **Tier awareness**: Adjust limits based on API tier

---

## 7. Timeout Configuration

### Decision: 30 second timeout for translation requests

### Rationale

AI APIs can be slow for complex requests. Timeouts prevent:

1. **Hanging requests**: User waits indefinitely
2. **Resource exhaustion**: Server connections pile up
3. **Poor UX**: No feedback on progress

### Recommended Timeout Values

**Simple translations** (< 1000 tokens):
- Timeout: 10-20 seconds
- Expected response: 2-8 seconds

**Complex translations** (1000-10000 tokens):
- Timeout: 30-60 seconds
- Expected response: 10-30 seconds

**Streaming (future)**:
- Initial token: 5-6 seconds
- Full response: Depends on length

### Implementation with Timeout

```typescript
async function translateWithTimeout(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  timeoutMs: number = 30000
): Promise<string> {
  return Promise.race([
    translateWithRetry(text, sourceLanguage, targetLanguage),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Translation timeout')), timeoutMs)
    )
  ]);
}
```

### Environment Configuration

```env
# Timeout in milliseconds
TRANSLATION_TIMEOUT_MS=30000
```

```typescript
export const config = {
  translation: {
    timeoutMs: parseInt(process.env.TRANSLATION_TIMEOUT_MS || '30000', 10),
    maxTokens: 10000
  }
};
```

### Timeout Error Handling

```typescript
try {
  const translation = await translateWithTimeout(text, source, target);
  return translation;
} catch (error) {
  if (error.message === 'Translation timeout') {
    logger.error('Translation timeout', { source, target, textLength: text.length });
    throw new TranslationError(
      'Translation request timed out. Please try with shorter text or try again later.'
    );
  }
  throw error;
}
```

### Best Practices

1. **Progressive timeouts**: Shorter for small texts, longer for large texts
2. **User feedback**: Show loading state during translation
3. **Fallback**: Consider chunking large texts if timeout occurs
4. **Monitoring**: Track timeout rates to adjust settings

---

## 8. Security Considerations

### Decision: Multi-layer security validation

### Rationale

Security is critical when accepting user input and calling external APIs:

1. **Input validation**: Prevent injection attacks
2. **API key protection**: Secure credential management
3. **Rate limiting**: Prevent abuse
4. **Error messages**: Don't leak sensitive information

### Security Checklist

**1. API Key Security**
```typescript
// ✅ DO: Environment variables
const apiKey = process.env.GEMINI_API_KEY;

// ❌ DON'T: Hardcode in source
const apiKey = 'AIzaSy...'; // NEVER!

// ✅ DO: Validate API key exists
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}
```

**2. Input Validation**
```typescript
// Validate text input
function validateTranslationInput(text: string): void {
  if (!text || typeof text !== 'string') {
    throw new ValidationError('Text is required');
  }

  // Limit text length (prevent abuse)
  const maxLength = 50000; // ~10,000 tokens
  if (text.length > maxLength) {
    throw new ValidationError(`Text exceeds maximum length: ${maxLength} characters`);
  }

  // Optional: Check for suspicious patterns
  const suspiciousPatterns = [/<script>/i, /javascript:/i];
  if (suspiciousPatterns.some(pattern => pattern.test(text))) {
    logger.warn('Suspicious input detected', { text: text.substring(0, 100) });
  }
}
```

**3. Rate Limiting per User/IP**
```typescript
import rateLimit from 'express-rate-limit';

const translationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per IP
  message: 'Too many requests from this IP'
});
```

**4. Sanitize Error Messages**
```typescript
// ❌ DON'T: Expose internal details
throw new Error(`API key invalid: ${process.env.GEMINI_API_KEY}`);

// ✅ DO: Generic error messages
throw new Error('Translation service configuration error');

// ✅ DO: Log details privately
logger.error('API key validation failed', { key: apiKey.substring(0, 10) + '...' });
```

**5. CORS Configuration**
```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true
}));
```

**6. Request Validation Middleware**
```typescript
import { body, validationResult } from 'express-validator';

const validateTranslationRequest = [
  body('text').notEmpty().isString().isLength({ max: 50000 }),
  body('sourceLanguage').notEmpty().isString().isLength({ min: 2, max: 2 }),
  body('targetLanguage').notEmpty().isString().isLength({ min: 2, max: 2 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid request', details: errors.array() }
      });
    }
    next();
  }
];

router.post('/translate', validateTranslationRequest, translateHandler);
```

### Best Practices

1. **Principle of least privilege**: API key with minimal required permissions
2. **Secrets management**: Use environment variables or secret managers (AWS Secrets Manager, etc.)
3. **Audit logging**: Log all translation requests (user, timestamp, languages)
4. **IP allowlisting**: Restrict API access to known IPs (production)
5. **HTTPS only**: Enforce TLS for all API communication
6. **Content type validation**: Ensure `Content-Type: application/json`

---

## 9. Testing Strategy

### Decision: Unit tests + integration tests + API mocks

### Rationale

Comprehensive testing ensures:

1. **Reliability**: Catch bugs before production
2. **Refactoring confidence**: Change code safely
3. **Documentation**: Tests show usage examples
4. **CI/CD**: Automated quality checks

### Test Structure

```
tests/
├── unit/
│   ├── language-validation.service.test.ts
│   ├── translation.service.test.ts
│   └── translate-text.use-case.test.ts
├── integration/
│   ├── translation-api.integration.test.ts
│   └── gemini-client.integration.test.ts
└── fixtures/
    └── sample-texts.ts
```

### Unit Test Example

```typescript
// tests/unit/language-validation.service.test.ts
import { LanguageValidationService } from '@infrastructure/services/language-validation.service';
import { InvalidLanguageError } from '@domain/errors';

describe('LanguageValidationService', () => {
  let service: LanguageValidationService;

  beforeEach(() => {
    service = new LanguageValidationService();
  });

  describe('validateLanguageCode', () => {
    it('should accept valid ISO 639-1 codes', () => {
      expect(() => service.validateLanguageCode('en')).not.toThrow();
      expect(() => service.validateLanguageCode('fr')).not.toThrow();
      expect(() => service.validateLanguageCode('es')).not.toThrow();
    });

    it('should normalize to lowercase', () => {
      expect(() => service.validateLanguageCode('EN')).not.toThrow();
      expect(() => service.validateLanguageCode('Fr')).not.toThrow();
    });

    it('should reject invalid codes', () => {
      expect(() => service.validateLanguageCode('invalid')).toThrow(InvalidLanguageError);
      expect(() => service.validateLanguageCode('eng')).toThrow(InvalidLanguageError);
      expect(() => service.validateLanguageCode('')).toThrow(InvalidLanguageError);
    });
  });

  describe('validateLanguagePair', () => {
    it('should reject same source and target language', () => {
      expect(() => service.validateLanguagePair('en', 'en')).toThrow(InvalidLanguageError);
    });
  });
});
```

### Integration Test Example

```typescript
// tests/integration/translation-api.integration.test.ts
import request from 'supertest';
import { app } from '@presentation/server';

describe('POST /api/v1/translate', () => {
  it('should translate text successfully', async () => {
    const response = await request(app)
      .post('/api/v1/translate')
      .send({
        text: 'Hello, world!',
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.translatedText).toBeDefined();
    expect(response.body.data.sourceLanguage).toBe('en');
    expect(response.body.data.targetLanguage).toBe('fr');
  });

  it('should reject text exceeding token limit', async () => {
    const longText = 'word '.repeat(20000); // ~10k+ tokens

    const response = await request(app)
      .post('/api/v1/translate')
      .send({
        text: longText,
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.type).toBe('TokenLimitExceededError');
  });

  it('should reject invalid language codes', async () => {
    const response = await request(app)
      .post('/api/v1/translate')
      .send({
        text: 'Hello',
        sourceLanguage: 'invalid',
        targetLanguage: 'fr'
      })
      .expect(400);

    expect(response.body.error.type).toBe('InvalidLanguageError');
  });
});
```

### Mocking Gemini API

```typescript
// tests/mocks/gemini-client.mock.ts
import { jest } from '@jest/globals';

export const mockGeminiClient = {
  models: {
    generateContent: jest.fn().mockResolvedValue({
      text: JSON.stringify({
        translatedText: 'Bonjour, monde!',
        sourceLanguage: 'English',
        targetLanguage: 'French'
      })
    }),
    countTokens: jest.fn().mockResolvedValue({
      totalTokens: 100
    })
  }
};

// Usage in tests
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(() => mockGeminiClient)
}));
```

### Test Coverage Goals

- **Unit tests**: 90%+ coverage for services and use cases
- **Integration tests**: All API endpoints with success and error cases
- **Edge cases**: Token limits, invalid inputs, rate limiting, timeouts

### Best Practices

1. **Fast tests**: Mock external APIs in unit tests
2. **Real integration**: Use actual API in integration tests (with test API key)
3. **Fixtures**: Reuse sample texts across tests
4. **Cleanup**: Clean up any test data/logs after tests
5. **CI/CD**: Run tests on every commit

---

## 10. Monitoring and Observability

### Decision: Structured logging + metrics tracking

### Rationale

Observability is critical for:

1. **Debugging**: Track down production issues
2. **Performance**: Identify bottlenecks
3. **Usage**: Understand API usage patterns
4. **Costs**: Monitor API call volumes

### Key Metrics to Track

**Request Metrics**:
- Total translation requests
- Success rate
- Average response time
- Token usage per request

**Error Metrics**:
- Error rate by type (TokenLimitError, RateLimitError, etc.)
- Retry count
- Timeout rate

**Usage Metrics**:
- Language pair popularity
- Average text length
- Peak usage times

### Logging Implementation

```typescript
import logger from '@infrastructure/logger';

async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  logger.info('Translation started', {
    requestId,
    sourceLanguage,
    targetLanguage,
    textLength: text.length
  });

  try {
    // Count tokens
    const tokenCount = await countTokens(text);
    logger.info('Token count', { requestId, tokenCount });

    // Translate
    const result = await translateWithRetry(text, sourceLanguage, targetLanguage);

    const duration = Date.now() - startTime;
    logger.info('Translation completed', {
      requestId,
      duration,
      resultLength: result.length
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Translation failed', {
      requestId,
      duration,
      error: error.message,
      errorType: error.name
    });
    throw error;
  }
}
```

### Dashboard Metrics (Future)

Consider integrating with:
- **Prometheus** + Grafana for metrics
- **ELK Stack** (Elasticsearch, Logstash, Kibana) for log analysis
- **Datadog** or **New Relic** for APM
- **Google Cloud Monitoring** if using Vertex AI

### Alerting Rules

Set up alerts for:
- Error rate > 5%
- Response time > 30 seconds (p95)
- Rate limit approaching (80% of quota)
- API key errors (configuration issue)

---

## Summary

All technical decisions for the Text Translation API feature are documented with clear rationales. Key takeaways:

### Technology Stack
- **SDK**: `@google/genai` (v1.25.0+) - unified, future-proof
- **Token counting**: Built-in `models.countTokens()` method
- **Language validation**: `iso-639-1` npm package
- **Retry logic**: `exponential-backoff` package
- **Rate limiting**: Express middleware + client-side queue

### Best Practices
1. **Security**: Environment variable for API key, input validation, rate limiting
2. **Reliability**: Exponential backoff retry, timeout handling, graceful errors
3. **User Experience**: Clear error messages, supported languages endpoint
4. **Observability**: Structured logging, metrics tracking, request IDs
5. **Testing**: Unit tests with mocks, integration tests with real API

### Configuration Requirements
- `GEMINI_API_KEY`: API key from Google AI Studio
- `GEMINI_MODEL`: Model selection (default: gemini-2.0-flash-001)
- `TRANSLATION_TIMEOUT_MS`: Request timeout (default: 30000ms)
- `GEMINI_RATE_LIMIT_RPM`: Rate limit per minute (default: 5 for free tier)

### API Limits
- Token limit: 10,000 tokens per request
- Free tier: 5 RPM, 25 RPD, 32k TPM
- Character limit: ~50,000 characters (approximately 10k tokens)

### Implementation Priority
1. Core translation service with Gemini SDK
2. Language code validation
3. Token counting and validation
4. Error handling and retry logic
5. Rate limiting
6. Comprehensive testing

These decisions align with the MVP requirements and provide a solid foundation for the Text Translation API feature.
