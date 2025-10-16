# Data Model: Text Translation API

**Feature**: Text Translation API
**Branch**: 002-api-translate-at
**Created**: 2025-10-16

## Overview

This document defines the data structures and entities for the Text Translation API. The feature follows Clean Architecture principles with entities in the domain layer and DTOs in the presentation layer.

## Domain Entities

### TranslationItem

Represents a single text item to be translated, including its content and positional metadata.

**Location**: `src/domain/entities/translation-item.entity.ts`

**Properties**:

| Property | Type | Required | Description | Validation Rules |
|----------|------|----------|-------------|------------------|
| id | string | Yes | Unique identifier for the text item | Non-empty string, max 100 chars |
| text | string | Yes | The text content to translate | Non-empty string, max 50,000 chars |
| position | Position | Yes | Location metadata from source document | Valid Position object |

**Position Sub-type**:

| Property | Type | Required | Description | Validation Rules |
|----------|------|----------|-------------|------------------|
| page | number | Yes | Page number in source document | Integer ≥ 1 |
| x | number | Yes | Horizontal coordinate | Number ≥ 0 |
| y | number | Yes | Vertical coordinate | Number ≥ 0 |

**Example**:
```typescript
{
  id: "item-1",
  text: "Hello, world!",
  position: {
    page: 1,
    x: 100,
    y: 200
  }
}
```

**Invariants**:
- All fields are immutable after creation
- Position coordinates represent logical positioning (not physical pixels)
- Text content is preserved exactly as provided (no normalization)

---

### TranslationJob (Value Object)

Represents a complete translation request with multiple items.

**Location**: `src/domain/entities/translation-job.entity.ts`

**Properties**:

| Property | Type | Required | Description | Validation Rules |
|----------|------|----------|-------------|------------------|
| requestId | string | Yes | Unique identifier for this job | UUID v4 format |
| sourceLanguage | string | Yes | ISO 639-1 source language code | Valid ISO 639-1 code (lowercase) |
| targetLanguage | string | Yes | ISO 639-1 target language code | Valid ISO 639-1 code (lowercase) |
| items | TranslationItem[] | Yes | Array of text items to translate | 1-100 items, total ≤10k tokens |
| createdAt | Date | Yes | Timestamp of request creation | Valid Date |
| totalTokens | number | No | Estimated total tokens across all items | Calculated, ≤10,000 |

**Example**:
```typescript
{
  requestId: "550e8400-e29b-41d4-a716-446655440000",
  sourceLanguage: "en",
  targetLanguage: "fr",
  items: [
    { id: "item-1", text: "Hello", position: { page: 1, x: 100, y: 200 } },
    { id: "item-2", text: "World", position: { page: 1, x: 100, y: 250 } }
  ],
  createdAt: new Date("2025-10-16T10:30:00Z"),
  totalTokens: 15
}
```

**Business Rules**:
- Source and target languages must be different (same-language translation rejected)
- Items array cannot be empty
- Total tokens across all items must not exceed 10,000
- All item IDs must be unique within a job
- RequestId is generated server-side (not client-provided)

---

### TranslatedItem (Value Object)

Represents the result of translating a single item.

**Location**: `src/domain/entities/translated-item.entity.ts`

**Properties**:

| Property | Type | Required | Description | Validation Rules |
|----------|------|----------|-------------|------------------|
| id | string | Yes | Original item ID (preserved from request) | Matches original TranslationItem.id |
| text | string | Yes | Translated text content | Non-empty string |
| position | Position | Yes | Original position (preserved from request) | Matches original TranslationItem.position |

**Example**:
```typescript
{
  id: "item-1",
  text: "Bonjour, le monde!",
  position: {
    page: 1,
    x: 100,
    y: 200
  }
}
```

**Invariants**:
- ID and position are exactly copied from the original TranslationItem
- Only the text field contains the translated content
- Structure is identical to TranslationItem (facilitates client mapping)

---

## Presentation Layer DTOs

### TranslateRequestDto

Request payload for POST /api/v1/translate endpoint.

**Location**: `src/presentation/dto/translate-request.dto.ts`

**Properties**:

| Property | Type | Required | Description | Validation Rules |
|----------|------|----------|-------------|------------------|
| sourceLanguage | string | Yes | Source language code | ISO 639-1 format, validated |
| targetLanguage | string | Yes | Target language code | ISO 639-1 format, validated |
| items | RequestItemDto[] | Yes | Array of items to translate | 1-100 items |

**RequestItemDto Sub-type**:

| Property | Type | Required | Description | Validation Rules |
|----------|------|----------|-------------|------------------|
| id | string | Yes | Client-provided item identifier | Non-empty string, max 100 chars |
| text | string | Yes | Text to translate | Non-empty string, max 50,000 chars |
| position | PositionDto | Yes | Position metadata | Valid PositionDto |

**PositionDto Sub-type**:

| Property | Type | Required | Description | Validation Rules |
|----------|------|----------|-------------|------------------|
| page | number | Yes | Page number | Integer ≥ 1 |
| x | number | Yes | X coordinate | Number ≥ 0 |
| y | number | Yes | Y coordinate | Number ≥ 0 |

**Example**:
```json
{
  "sourceLanguage": "en",
  "targetLanguage": "fr",
  "items": [
    {
      "id": "item-1",
      "text": "Hello, world!",
      "position": { "page": 1, "x": 100, "y": 200 }
    }
  ]
}
```

**Validation Rules**:
- All fields are required
- sourceLanguage ≠ targetLanguage
- All item IDs must be unique
- Total payload size < 1MB
- Total estimated tokens ≤ 10,000

---

### TranslateResponseDto

Response payload for successful translations.

**Location**: `src/presentation/dto/translate-response.dto.ts`

**Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| success | boolean | Yes | Always true for 200 responses |
| message | string | Yes | Human-readable success message |
| data | TranslatedItemDto[] | Yes | Array of translated items |

**TranslatedItemDto Sub-type**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Original item ID |
| text | string | Yes | Translated text |
| position | PositionDto | Yes | Original position |

**Example**:
```json
{
  "success": true,
  "message": "Text translated successfully.",
  "data": [
    {
      "id": "item-1",
      "text": "Bonjour, le monde!",
      "position": { "page": 1, "x": 100, "y": 200 }
    }
  ]
}
```

---

### ErrorResponseDto

Response payload for failed requests.

**Location**: `src/presentation/dto/error-response.dto.ts` (reuse existing)

**Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| success | boolean | Yes | Always false for error responses |
| message | string | Yes | Human-readable error message |
| error | ErrorDetail | No | Additional error context |

**ErrorDetail Sub-type**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| code | string | Yes | Machine-readable error code |
| details | any | No | Additional error-specific information |

**Example - Token Limit Exceeded**:
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

**Example - Invalid Language**:
```json
{
  "success": false,
  "message": "Invalid language code provided.",
  "error": {
    "code": "INVALID_LANGUAGE",
    "details": {
      "field": "sourceLanguage",
      "value": "xyz",
      "validCodes": ["en", "fr", "es", "de", "..."]
    }
  }
}
```

---

## Data Flow

```
Client Request (JSON)
  ↓
TranslateRequestDto (validation)
  ↓
TranslationJob (domain entity)
  ↓
TranslateTextUseCase (orchestration)
  ↓
GeminiTranslationService (external API)
  ↓
TranslatedItem[] (domain results)
  ↓
TranslateResponseDto (serialization)
  ↓
Client Response (JSON)
```

---

## Validation Summary

### Request Validation (Presentation Layer)

1. **Schema Validation**: All required fields present, correct types
2. **Language Validation**: Valid ISO 639-1 codes using `iso-639-1` package
3. **Token Validation**: Total tokens ≤ 10,000 using Gemini SDK `countTokens()`
4. **ID Uniqueness**: No duplicate item IDs within request
5. **Array Size**: 1-100 items per request
6. **String Lengths**: Text ≤ 50,000 chars, ID ≤ 100 chars
7. **Number Ranges**: page ≥ 1, x ≥ 0, y ≥ 0

### Domain Validation (Application Layer)

1. **Business Rules**: Source ≠ target language
2. **Entity Invariants**: Immutability, non-null constraints
3. **Job Integrity**: RequestId is valid UUID, createdAt is valid timestamp

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_LANGUAGE` | 400 | Invalid language code |
| `EMPTY_ITEMS` | 400 | Items array is empty |
| `TOKEN_LIMIT_EXCEEDED` | 413 | Total tokens > 10,000 |
| `TRANSLATION_SERVICE_UNAVAILABLE` | 503 | Gemini API unreachable |
| `TRANSLATION_FAILED` | 422 | Translation service returned error |
| `INVALID_REQUEST` | 400 | Malformed JSON or missing fields |
| `TIMEOUT` | 504 | Request exceeded 30s timeout |

---

## Implementation Notes

1. **Immutability**: All domain entities are immutable (readonly properties)
2. **Type Safety**: Strict TypeScript with no `any` types
3. **Validation Libraries**: Use `class-validator` for DTO validation (existing pattern)
4. **Token Counting**: Performed before creating TranslationJob to fail fast
5. **ID Preservation**: Client-provided IDs are preserved throughout the flow
6. **Error Mapping**: Infrastructure errors mapped to domain errors in use case layer
