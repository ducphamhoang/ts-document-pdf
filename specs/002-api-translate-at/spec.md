# Feature Specification: Text Translation API

**Feature Branch**: `002-api-translate-at`
**Created**: 2025-10-16
**Status**: Draft
**Input**: User description: "api-translate at @docs/prd-translation-api.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Batch Text Translation (Priority: P1)

Client applications need to translate multiple text items from one language to another while preserving the structure and positional metadata of the original content.

**Why this priority**: This is the core functionality of the API - enabling multilingual capabilities for client applications. Without this, the API has no value.

**Independent Test**: Can be fully tested by sending a POST request with valid source language, target language, and an array of text items, then verifying the response contains translated text for each item with preserved IDs and position data.

**Acceptance Scenarios**:

1. **Given** a client has text items in English, **When** they send a translation request to French with valid text items, **Then** they receive translated French text for each item with the same IDs and position metadata
2. **Given** a client sends 10 text items totaling approximately 1000 tokens, **When** the translation request is processed, **Then** the response is returned in under 3 seconds
3. **Given** a client sends text items with special characters and formatting, **When** translation is requested, **Then** the translated text maintains appropriate formatting for the target language

---

### User Story 2 - Error Handling and Validation (Priority: P2)

Client applications need clear feedback when translation requests fail due to invalid input, service unavailability, or other errors.

**Why this priority**: Robust error handling is critical for production reliability and debugging, but the basic translation functionality must work first.

**Independent Test**: Can be tested independently by sending various invalid requests (missing fields, invalid languages, empty arrays, malformed JSON) and verifying appropriate error codes and messages are returned.

**Acceptance Scenarios**:

1. **Given** a client sends a request with an invalid language code, **When** the API validates the request, **Then** a 400 Bad Request response is returned with a descriptive error message
2. **Given** a client sends a request with an empty items array, **When** the API validates the request, **Then** a 400 Bad Request response is returned indicating items cannot be empty
3. **Given** the translation service is unavailable, **When** a client sends a valid translation request, **Then** a 503 Service Unavailable response is returned
4. **Given** a client sends malformed JSON, **When** the API attempts to parse the request, **Then** a 400 Bad Request response is returned with a JSON parsing error message

---

### User Story 3 - Payload Size Management (Priority: P3)

Client applications need to understand and stay within payload size limits to ensure successful translation requests.

**Why this priority**: This prevents abuse and ensures system stability, but is less critical than core functionality and basic error handling.

**Independent Test**: Can be tested by sending requests of varying sizes and verifying that requests under the token limit succeed while oversized requests are rejected with appropriate error messages.

**Acceptance Scenarios**:

1. **Given** a client sends text content totaling 9,500 tokens, **When** the request is processed, **Then** the translation succeeds
2. **Given** a client sends text content exceeding 10,000 tokens, **When** the API validates the request, **Then** a 413 Payload Too Large response is returned

---

### Edge Cases

- What happens when a single text item contains unsupported characters or symbols that cannot be translated?
- How does the system handle requests where the source and target languages are the same?
- What happens when the translation service returns partial results or inconsistent output?
- How does the system handle extremely short text (single character or emoji)?
- What happens when network connectivity is lost mid-translation?
- How does the system handle concurrent requests from the same client?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept POST requests to a translation endpoint with JSON payloads containing source language, target language, and an array of text items
- **FR-002**: System MUST validate that source language and target language fields are present and contain valid language codes
- **FR-003**: System MUST validate that the items array is not empty
- **FR-004**: System MUST validate that the total token count of all text content does not exceed 10,000 tokens
- **FR-005**: System MUST send each text item to a generative AI translation service for processing
- **FR-006**: System MUST return translated text for each item while preserving the original item's ID and position metadata
- **FR-007**: System MUST return a 200 OK response with translated data when translation succeeds
- **FR-008**: System MUST return a 400 Bad Request response when required fields are missing or invalid
- **FR-009**: System MUST return a 413 Payload Too Large response when text content exceeds the token limit
- **FR-010**: System MUST return a 503 Service Unavailable response when the translation service is unavailable
- **FR-011**: System MUST return a 422 Unprocessable Entity response when translation fails for semantic or content reasons
- **FR-012**: System MUST log all translation requests, responses, and errors with request identifiers for traceability
- **FR-013**: System MUST sanitize input text to prevent injection attacks
- **FR-014**: System MUST handle malformed JSON requests and return appropriate error responses
- **FR-015**: System MUST process successful translation requests in under 3 seconds for standard payloads (10 items, ~1000 tokens)

### Key Entities

- **Translation Request**: Represents a batch translation job containing source language, target language, and an array of text items to be translated
- **Text Item**: Individual piece of text to translate, identified by a unique ID and associated with position metadata (page, x, y coordinates)
- **Translated Item**: Result of translating a single text item, containing the translated text while preserving the original ID and position metadata
- **Translation Response**: Collection of all translated items returned to the client, maintaining the same structure as the request

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Client applications can successfully translate batches of text in under 3 seconds for standard requests (10 items, ~1000 tokens)
- **SC-002**: Translation accuracy meets user expectations (subjectively assessed as "correct" by native speakers for common phrases and business content)
- **SC-003**: System handles at least 100 concurrent translation requests without failures or performance degradation
- **SC-004**: Error responses are clear enough that client developers can diagnose and fix issues without additional support in 95% of cases
- **SC-005**: Zero data loss - every item sent for translation receives either a translated result or a clear error indication
- **SC-006**: System maintains 99.5% uptime for translation requests (excluding external service downtime)

## Assumptions *(mandatory)*

- Access to a generative AI translation service (such as Google Gemini) is available via API with an API key
- The API key for the translation service is stored securely in environment configuration and not exposed in the codebase
- Language codes follow standard ISO 639-1 format (e.g., "en-US", "fr-FR")
- Position metadata (page, x, y coordinates) is provided by clients and represents logical positioning in source documents
- The translation service supports all commonly used language pairs
- Input text is primarily business or general content, not requiring specialized domain translation
- Token counting uses standard UTF-8 character-to-token estimation methods
- Client applications are responsible for breaking larger documents into multiple requests if they exceed the 10,000 token limit
- No authentication is required for the initial version (public API)
- Translation requests are stateless - no session or user context is maintained between requests

## Scope *(mandatory)*

### In Scope

- REST API endpoint for batch text translation
- Input validation for language codes, text content, and payload size
- Integration with generative AI translation service
- Structured error handling with appropriate HTTP status codes
- Request/response logging with unique identifiers
- Preservation of item IDs and position metadata through translation
- Basic input sanitization for security

### Out of Scope

- User authentication and authorization
- Translation history or caching of previous translations
- Rate limiting per client or API key
- Support for file upload (only JSON payloads accepted)
- Custom translation glossaries or terminology management
- Translation quality scoring or confidence metrics
- Support for right-to-left languages with special formatting
- Streaming or real-time translation
- Translation memory or suggestion features
- Batch job queuing for large-scale translations
- Webhook callbacks for asynchronous translation completion

## Dependencies *(mandatory)*

- External generative AI translation service (e.g., Google Gemini API)
- Secure environment configuration for storing API credentials
- Existing application infrastructure (Node.js runtime, Express framework)
- JSON parsing and validation capabilities
- Logging infrastructure for request traceability
