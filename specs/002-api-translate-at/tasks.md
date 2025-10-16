# Tasks: Text Translation API

**Input**: Design documents from `/specs/002-api-translate-at/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.openapi.yaml

**Tests**: Tests are included based on plan.md testing strategy (Jest unit tests + Supertest integration tests)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Single project** (Clean Architecture): `src/domain/`, `src/application/`, `src/infrastructure/`, `src/presentation/`, `tests/`
- All paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and configure environment for translation feature

- [ ] **T001** [P] Install Google Gemini SDK: `npm install @google/genai@1.25.0`
- [ ] **T002** [P] Install language validation package: `npm install iso-639-1@3.1.5`
- [ ] **T003** [P] Install retry logic package: `npm install exponential-backoff`
- [ ] **T004** Update environment configuration in `config/.env.example` with:
  ```
  GEMINI_API_KEY=your_api_key_here
  GEMINI_MODEL=gemini-2.0-flash-001
  TRANSLATION_TIMEOUT_MS=30000
  GEMINI_RATE_LIMIT_RPM=5
  ```

**Checkpoint**: Dependencies installed, environment configured

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain entities and error types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] **T005** [P] [Foundation] Create domain error classes in `src/domain/errors/index.ts`:
  - `TranslationError` (base class)
  - `InvalidLanguageError` extends TranslationError
  - `TokenLimitExceededError` extends TranslationError
  - `TranslationServiceUnavailableError` extends TranslationError
  - `TranslationTimeoutError` extends TranslationError

- [ ] **T006** [P] [Foundation] Create Position type/interface in `src/domain/entities/translation-item.entity.ts`:
  ```typescript
  interface Position {
    readonly page: number;
    readonly x: number;
    readonly y: number;
  }
  ```

- [ ] **T007** [Foundation] Create TranslationItem entity in `src/domain/entities/translation-item.entity.ts`:
  - Properties: id (string), text (string), position (Position)
  - All properties readonly (immutable)
  - No validation logic (pure entity)

- [ ] **T008** [Foundation] Create TranslationJob entity in `src/domain/entities/translation-job.entity.ts`:
  - Properties: requestId (string), sourceLanguage (string), targetLanguage (string), items (TranslationItem[]), createdAt (Date), totalTokens? (number)
  - All properties readonly
  - No external dependencies

- [ ] **T009** [Foundation] Create TranslatedItem entity in `src/domain/entities/translated-item.entity.ts`:
  - Same structure as TranslationItem
  - Represents result after translation

**Checkpoint**: Foundation ready - domain entities and errors defined. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Batch Text Translation (Priority: P1) 🎯 MVP

**Goal**: Core translation functionality - translate multiple text items while preserving IDs and position metadata

**Independent Test**: Send POST request with valid English text items, verify French translations returned with preserved IDs/positions

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] **T010** [P] [US1] Create unit test file `tests/unit/gemini-translation.service.test.ts`:
  - Test: Successfully translates single item
  - Test: Successfully translates multiple items (batch)
  - Test: Preserves item IDs through translation
  - Test: Preserves position metadata through translation
  - Test: Handles Gemini API errors gracefully
  - Test: Retries on transient failures (429, 503)
  - Test: Does not retry on permanent failures (401, 400)
  - Mock Gemini SDK responses

- [ ] **T011** [P] [US1] Create unit test file `tests/unit/translate-text.use-case.test.ts`:
  - Test: Orchestrates translation of valid request
  - Test: Returns translated items with preserved metadata
  - Test: Calls translation service with correct parameters
  - Test: Maps service results to domain entities
  - Mock ITranslationService interface

- [ ] **T012** [P] [US1] Create integration test file `tests/integration/translation-api.integration.test.ts`:
  - Test: POST /api/v1/translate with English → French (2 items)
  - Test: Response contains translated text
  - Test: Response preserves all IDs and positions
  - Test: Response time < 3 seconds for standard payload (10 items, ~1000 tokens)
  - Test: Handles concurrent requests (spawn 10 parallel requests)
  - Use real HTTP calls with Supertest
  - Mock or use test Gemini API key

### Implementation for User Story 1

- [ ] **T013** [P] [US1] Create ITranslationService interface in `src/application/interfaces/translation.interface.ts`:
  ```typescript
  interface ITranslationService {
    translateText(
      text: string,
      sourceLanguage: string,
      targetLanguage: string
    ): Promise<string>;

    countTokens(text: string): Promise<number>;
  }
  ```

- [ ] **T014** [P] [US1] Create TranslateRequestDto in `src/presentation/dto/translate-request.dto.ts`:
  - Use class-validator decorators
  - Validate sourceLanguage, targetLanguage, items array
  - Sub-types: RequestItemDto, PositionDto
  - Validation: required fields, string lengths, number ranges

- [ ] **T015** [P] [US1] Create TranslateResponseDto in `src/presentation/dto/translate-response.dto.ts`:
  - Properties: success (boolean), message (string), data (TranslatedItemDto[])
  - Sub-type: TranslatedItemDto (id, text, position)

- [ ] **T016** [US1] Implement GeminiTranslationService in `src/infrastructure/services/gemini-translation.service.ts`:
  - Implements ITranslationService
  - Initialize GoogleGenAI client with API key from env
  - Implement `translateText()`: Call Gemini API with prompt engineering
  - Implement `countTokens()`: Use Gemini SDK `models.countTokens()`
  - Add exponential backoff retry logic (3 attempts, 1s → 10s delays)
  - Add 30s timeout handling
  - Map API errors to domain errors
  - Add Winston logging for requests/responses/errors

- [ ] **T017** [US1] Implement TranslateTextUseCase in `src/application/use-cases/translate-text.use-case.ts`:
  - Constructor: Accept ITranslationService dependency
  - Create TranslationJob from request data
  - Generate UUID for requestId
  - Iterate through items and call translation service for each
  - Collect results into TranslatedItem[]
  - Return results preserving all IDs and positions
  - Map infrastructure errors to domain errors

- [ ] **T018** [US1] Create TranslationController in `src/presentation/controllers/translation.controller.ts`:
  - Constructor: Accept TranslateTextUseCase dependency
  - Method: `async translate(req, res, next)`:
    - Parse and validate TranslateRequestDto from request body
    - Call use case with validated data
    - Format response as TranslateResponseDto
    - Handle errors with appropriate HTTP status codes
    - Add request logging with unique request ID

- [ ] **T019** [US1] Create translation routes in `src/presentation/routes/translation.routes.ts`:
  - Define POST /api/v1/translate route
  - Wire up TranslationController.translate handler
  - Apply existing validation middleware
  - Apply existing error middleware
  - Export router

- [ ] **T020** [US1] Register translation routes in main server file `src/server.ts`:
  - Import translation routes
  - Mount at /api/v1
  - Ensure routes are registered after middleware setup

- [ ] **T021** [US1] Create service initialization in `src/shared/services.ts` or equivalent:
  - Instantiate GeminiTranslationService with config
  - Instantiate TranslateTextUseCase with service dependency
  - Instantiate TranslationController with use case dependency
  - Export instances for route handlers

**Checkpoint**: At this point, User Story 1 should be fully functional. Run tests, verify translations work end-to-end via POST /api/v1/translate

---

## Phase 4: User Story 2 - Error Handling and Validation (Priority: P2)

**Goal**: Comprehensive error handling for invalid input, service failures, and edge cases

**Independent Test**: Send various invalid requests (bad language codes, empty arrays, malformed JSON), verify appropriate error responses

### Tests for User Story 2

- [ ] **T022** [P] [US2] Add validation tests to `tests/unit/translate-text.use-case.test.ts`:
  - Test: Rejects invalid source language code
  - Test: Rejects invalid target language code
  - Test: Rejects empty items array
  - Test: Rejects same source and target language
  - Test: Rejects duplicate item IDs
  - Test: Returns appropriate error codes

- [ ] **T023** [P] [US2] Add error handling tests to `tests/integration/translation-api.integration.test.ts`:
  - Test: POST with invalid language code → 400 Bad Request
  - Test: POST with empty items array → 400 Bad Request
  - Test: POST with malformed JSON → 400 Bad Request
  - Test: POST with same source/target language → 400 Bad Request
  - Test: Simulate Gemini API down → 503 Service Unavailable
  - Test: Simulate Gemini API error → 422 Unprocessable Entity
  - Test: Verify error response structure (success: false, message, error.code)

### Implementation for User Story 2

- [ ] **T024** [P] [US2] Add language validation to TranslateRequestDto in `src/presentation/dto/translate-request.dto.ts`:
  - Import `iso-639-1` package
  - Add custom validator for ISO 639-1 codes
  - Add validator to ensure sourceLanguage ≠ targetLanguage
  - Add validator for unique item IDs

- [ ] **T025** [P] [US2] Enhance validation middleware in `src/presentation/middleware/validation.middleware.ts`:
  - If not exists, create middleware to validate DTOs using class-validator
  - Return 400 Bad Request with detailed validation errors
  - Include field names and validation failure reasons

- [ ] **T026** [US2] Add comprehensive error handling to GeminiTranslationService in `src/infrastructure/services/gemini-translation.service.ts`:
  - Catch and classify Gemini API errors:
    - 401/403 → TranslationServiceUnavailableError (auth issue)
    - 429 → Rate limit (retry with backoff)
    - 500-599 → TranslationServiceUnavailableError (server error, retry)
    - 400 → TranslationError (bad request, don't retry)
    - Timeout → TranslationTimeoutError
  - Log all errors with request context
  - Include error details in thrown exceptions

- [ ] **T027** [US2] Add error handling to TranslateTextUseCase in `src/application/use-cases/translate-text.use-case.ts`:
  - Validate business rules:
    - Items array not empty
    - Source ≠ target language
    - Item IDs are unique
  - Catch service errors and map to appropriate domain errors
  - Add structured logging for all errors with request ID

- [ ] **T028** [US2] Update error middleware in `src/presentation/middleware/error.middleware.ts`:
  - Map domain errors to HTTP status codes:
    - InvalidLanguageError → 400
    - TokenLimitExceededError → 413
    - TranslationServiceUnavailableError → 503
    - TranslationTimeoutError → 504
    - TranslationError (generic) → 422
  - Return consistent error response format:
    ```json
    {
      "success": false,
      "message": "Human-readable error",
      "error": {
        "code": "ERROR_CODE",
        "details": {}
      }
    }
    ```
  - Sanitize error messages (don't expose internals)

- [ ] **T029** [US2] Update TranslationController in `src/presentation/controllers/translation.controller.ts`:
  - Add try-catch around use case calls
  - Pass errors to error middleware via `next(error)`
  - Ensure all error paths are logged

**Checkpoint**: At this point, User Stories 1 AND 2 should both work. Test that valid requests succeed and invalid requests return clear errors.

---

## Phase 5: User Story 3 - Payload Size Management (Priority: P3)

**Goal**: Token counting and payload size validation to prevent abuse and ensure performance

**Independent Test**: Send requests with varying sizes (under limit, at limit, over limit), verify appropriate handling

### Tests for User Story 3

- [ ] **T030** [P] [US3] Add token validation tests to `tests/unit/translate-text.use-case.test.ts`:
  - Test: Accepts request with 9,500 tokens
  - Test: Rejects request with 10,001 tokens → TokenLimitExceededError
  - Test: Correctly sums tokens across all items
  - Test: Includes actual and max token counts in error details

- [ ] **T031** [P] [US3] Add payload size tests to `tests/integration/translation-api.integration.test.ts`:
  - Test: POST with ~9,500 tokens → 200 OK
  - Test: POST with >10,000 tokens → 413 Payload Too Large
  - Test: Error response includes token count details
  - Test: Large single item (5,000 tokens) processes successfully
  - Test: Many small items (100 items, 100 tokens each) processes successfully

### Implementation for User Story 3

- [ ] **T032** [P] [US3] Add token counting to GeminiTranslationService in `src/infrastructure/services/gemini-translation.service.ts`:
  - Implement `countTokens(text: string)` method
  - Call Gemini SDK `models.countTokens()` with model name
  - Handle API errors gracefully
  - Cache results if same text counted multiple times (optimization)
  - Add logging for token counts

- [ ] **T033** [US3] Add token validation to TranslateTextUseCase in `src/application/use-cases/translate-text.use-case.ts`:
  - Before translation, count tokens for all items
  - Sum total tokens across all items
  - If total > 10,000:
    - Throw TokenLimitExceededError
    - Include actualTokens and maxTokens in error
  - Log token counts for all requests (for monitoring)

- [ ] **T034** [P] [US3] Add token limit validation to TranslateRequestDto in `src/presentation/dto/translate-request.dto.ts`:
  - Add custom validator that counts tokens
  - Fail validation if total > 10,000
  - Return 413 status via validation middleware

- [ ] **T035** [US3] Update error middleware in `src/presentation/middleware/error.middleware.ts`:
  - Ensure TokenLimitExceededError maps to 413 status
  - Include token details in error response:
    ```json
    {
      "error": {
        "code": "TOKEN_LIMIT_EXCEEDED",
        "details": {
          "actualTokens": 12500,
          "maxTokens": 10000
        }
      }
    }
    ```

**Checkpoint**: All three user stories should now be independently functional. Test each story in isolation and together.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] **T036** [P] Add request rate limiting (optional, but recommended):
  - Create rate limiter middleware for /api/v1/translate
  - Limit based on environment config (GEMINI_RATE_LIMIT_RPM)
  - Return 429 Too Many Requests when limit exceeded
  - File: `src/presentation/middleware/rate-limit.middleware.ts`

- [ ] **T037** [P] Add comprehensive logging:
  - Log all translation requests with request ID
  - Log translation duration, token count, language pair
  - Log error rates and types
  - Enhance Winston logger configuration if needed

- [ ] **T038** [P] Add monitoring metrics (optional):
  - Track request count, success rate, avg response time
  - Track token usage per request
  - Track error rates by type
  - Export metrics for observability platform

- [ ] **T039** [P] Update API documentation:
  - Verify OpenAPI spec matches implementation
  - Add example requests/responses to docs
  - Document error codes and meanings
  - Document rate limits and token limits

- [ ] **T040** [P] Add input sanitization:
  - Sanitize text input to prevent injection attacks
  - Validate string lengths (max 50,000 chars per item)
  - Validate position values (page ≥ 1, x/y ≥ 0)
  - Add to validation middleware

- [ ] **T041** Run quickstart.md validation:
  - Follow quickstart guide to verify accuracy
  - Test all curl examples
  - Verify client code examples work
  - Update guide with any discovered issues

- [ ] **T042** Code cleanup and refactoring:
  - Remove any console.log statements
  - Ensure consistent code style
  - Run linter and fix issues: `npm run lint`
  - Run formatter: `npm run format`

- [ ] **T043** Run full test suite:
  - Execute all unit tests: `npm test tests/unit/`
  - Execute all integration tests: `npm test tests/integration/`
  - Verify 100% of tests pass
  - Check test coverage (aim for >80%)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if multiple developers)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1) - Batch Translation**:
  - Depends on: Foundational (Phase 2)
  - Provides: Core translation functionality
  - Independent: Can be tested and deployed alone (MVP!)

- **User Story 2 (P2) - Error Handling**:
  - Depends on: Foundational (Phase 2), User Story 1 implementation
  - Enhances: Error handling for US1 components
  - Independent: Can test error scenarios separately from happy path

- **User Story 3 (P3) - Payload Size Management**:
  - Depends on: Foundational (Phase 2), User Story 1 implementation
  - Enhances: Validation for US1 components
  - Independent: Can test token limits separately from translation logic

### Within Each User Story

1. **Tests FIRST** (T010-T012 for US1, etc.):
   - Write all tests for the story
   - Verify tests FAIL (no implementation yet)
   - Tests marked [P] can run in parallel

2. **Models & Interfaces** (T013-T015 for US1):
   - Domain entities (if story-specific)
   - DTOs for request/response
   - Service interfaces
   - Can run in parallel [P]

3. **Core Implementation** (T016-T017 for US1):
   - Service layer (external integrations)
   - Use case layer (orchestration)
   - Must be sequential (use case depends on service)

4. **API Layer** (T018-T021 for US1):
   - Controller (depends on use case)
   - Routes (depends on controller)
   - Registration (depends on routes)
   - Must be sequential

5. **Verify Tests PASS**:
   - Run all tests for this story
   - Fix any failures
   - Story complete!

### Parallel Opportunities

- **Within Setup (Phase 1)**: All tasks [P] can run in parallel (T001-T003)
- **Within Foundational (Phase 2)**: Tasks T005-T006 can run in parallel, then T007-T009 sequential
- **Across User Stories**: Once Foundational completes, US1, US2, US3 can start in parallel (if team capacity allows)
- **Within User Story 1**:
  - Tests T010-T012 in parallel
  - DTOs T013-T015 in parallel
- **Within User Story 2**:
  - Tests T022-T023 in parallel
  - Implementation T024-T025 in parallel
- **Within User Story 3**:
  - Tests T030-T031 in parallel
  - Implementation T032 and T034 in parallel
- **Within Polish (Phase 6)**: Tasks T036-T042 can run in parallel

---

## Parallel Example: User Story 1

### Launch Tests Together (Phase 3, Tests)
```bash
# These can run in parallel - different test files:
Task T010: "Create tests/unit/gemini-translation.service.test.ts"
Task T011: "Create tests/unit/translate-text.use-case.test.ts"
Task T012: "Create tests/integration/translation-api.integration.test.ts"
```

### Launch DTOs Together (Phase 3, Implementation)
```bash
# These can run in parallel - different files:
Task T013: "Create ITranslationService interface"
Task T014: "Create TranslateRequestDto"
Task T015: "Create TranslateResponseDto"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**Goal**: Ship core translation functionality as fast as possible

1. ✅ Complete Phase 1: Setup (T001-T004) - ~15 minutes
2. ✅ Complete Phase 2: Foundational (T005-T009) - ~1 hour
3. ✅ Complete Phase 3: User Story 1 (T010-T021) - ~4-6 hours
4. **STOP and VALIDATE**:
   - Run all US1 tests
   - Manual testing: `curl -X POST http://localhost:3000/api/v1/translate`
   - Verify translations work
   - Check performance (<3s response time)
5. **Deploy/Demo**: MVP is ready! Basic translation works end-to-end

**Estimated Total**: 5-7 hours for MVP

---

### Incremental Delivery

**Goal**: Add features incrementally, each adding value

1. **Foundation** → Setup + Foundational → Dependencies installed, domain model ready
2. **MVP (US1)** → Add Batch Translation → Test independently → **DEMO** ✅
3. **v1.1 (US2)** → Add Error Handling → Test independently → **DEMO** ✅
4. **v1.2 (US3)** → Add Payload Limits → Test independently → **DEMO** ✅
5. **v1.3** → Polish & Monitoring → Final release

Each increment:
- Builds on previous work
- Independently testable
- Can be deployed alone
- Adds clear user value

---

### Parallel Team Strategy

**Goal**: Multiple developers working simultaneously

**Team Size: 3 developers**

**Week 1**:
- **Together**: Complete Setup (Phase 1) + Foundational (Phase 2)
  - Pair programming recommended for foundation
  - ~1 day

**Week 1-2**:
- **Developer A**: User Story 1 (P1) - Core translation
  - Tasks T010-T021
  - ~2-3 days
- **Developer B**: User Story 2 (P2) - Error handling
  - Wait for US1 controller/service to exist
  - Then tasks T022-T029
  - ~2 days
- **Developer C**: User Story 3 (P3) - Payload limits
  - Wait for US1 controller/service to exist
  - Then tasks T030-T035
  - ~1-2 days

**Week 2**:
- **All Together**: Integration testing
- **All Together**: Polish (Phase 6)
- **All Together**: Code review and merge

**Total Estimated Time**: 1.5-2 weeks with 3 developers

---

## Summary

### Total Task Count: 43 tasks

**By Phase**:
- Phase 1 (Setup): 4 tasks
- Phase 2 (Foundational): 5 tasks
- Phase 3 (User Story 1): 12 tasks (3 test files + 9 implementation)
- Phase 4 (User Story 2): 8 tasks (2 test enhancements + 6 implementation)
- Phase 5 (User Story 3): 6 tasks (2 test enhancements + 4 implementation)
- Phase 6 (Polish): 8 tasks

**By User Story**:
- User Story 1 (Batch Translation): 12 tasks - MVP critical
- User Story 2 (Error Handling): 8 tasks - Production critical
- User Story 3 (Payload Management): 6 tasks - Stability critical
- Shared (Setup + Foundational + Polish): 17 tasks

**Parallel Opportunities**: 18 tasks marked [P] can run in parallel

**Independent Test Criteria**:
- **US1**: POST /api/v1/translate with English text → Returns French translations with preserved IDs/positions
- **US2**: POST with invalid inputs → Returns appropriate 400/503/422 errors with clear messages
- **US3**: POST with >10k tokens → Returns 413 error with token details

**Suggested MVP Scope**:
- Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (User Story 1)
- Total: 21 tasks for working translation API
- Estimated time: 5-7 hours (single developer) or 1-2 days (with testing and refinement)

---

## Notes

- **[P] marker**: Tasks in different files with no dependencies - can run in parallel
- **[Story] label**: Maps task to specific user story (US1, US2, US3) for traceability
- **Test-first approach**: All test tasks (T010-T012, T022-T023, T030-T031) should be completed and FAILING before implementation
- **Checkpoints**: Stop after each phase/story to validate independently
- **Commit strategy**: Commit after each task or logical group of related tasks
- **File paths**: All paths are absolute from repository root
- **Error handling**: Every layer (presentation, application, infrastructure) has error handling responsibilities
- **Clean Architecture**: Dependency flow is always inward (presentation → application → domain)
- **Type safety**: Use strict TypeScript, no `any` types
- **Testing**: Aim for >80% code coverage, focus on critical paths first
