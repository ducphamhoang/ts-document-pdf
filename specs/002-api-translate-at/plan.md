# Implementation Plan: Text Translation API

**Branch**: `002-api-translate-at` | **Date**: 2025-10-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-api-translate-at/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a REST API endpoint (`/api/v1/translate`) that accepts JSON payloads containing text items with source and target languages, translates them using Google Gemini API, and returns translated text while preserving item IDs and position metadata. The implementation will follow the existing Clean Architecture pattern with new use cases, controllers, DTOs, and a translation service for external API integration.

## Technical Context

**Language/Version**: TypeScript 5.9.3 with Node.js 20.x LTS
**Primary Dependencies**: Express.js 4.x, @google/genai v1.25.0, iso-639-1 v3.1.5, exponential-backoff
**Storage**: N/A (stateless translation service)
**Testing**: Jest 29.x with Supertest for integration tests
**Target Platform**: Linux server (existing deployment infrastructure)
**Project Type**: Single project (Clean Architecture backend API)
**Performance Goals**: Process 10 items (~1000 tokens) in <3 seconds, support 100 concurrent requests
**Constraints**: <3s response time for standard payloads, 10,000 token payload limit, 30s timeout, 99.5% uptime target
**Scale/Scope**: API endpoint with 8-9 new files (use case, controller, routes, service, DTOs, entities), ~800-1000 LOC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: The project constitution file is currently a template. Applying standard Clean Architecture and TypeScript best practices.

### Clean Architecture Compliance

- ✅ **Layer Separation**: Feature follows existing structure (domain, application, infrastructure, presentation)
- ✅ **Dependency Rule**: Dependencies point inward (presentation → application → domain)
- ✅ **Interface Abstraction**: Translation service will use interface in application layer
- ✅ **Testability**: All layers independently testable with mocks/stubs

### TypeScript Best Practices

- ✅ **Type Safety**: Strict TypeScript with no `any` types
- ✅ **Error Handling**: Custom domain errors, structured error responses
- ✅ **Validation**: Input validation with clear error messages
- ✅ **Logging**: Winston logger integration (existing infrastructure)

### API Design Standards

- ✅ **REST Conventions**: Standard HTTP methods and status codes
- ✅ **Versioning**: `/api/v1` prefix for future compatibility
- ✅ **Error Format**: Consistent error response structure
- ✅ **Documentation**: OpenAPI/Swagger specification

**Status**: ✅ PASSED - No violations. Feature aligns with existing architecture patterns.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── domain/
│   └── entities/
│       └── translation-item.entity.ts         # NEW: Text item with position metadata
│
├── application/
│   ├── interfaces/
│   │   └── translation.interface.ts            # NEW: ITranslationService interface
│   └── use-cases/
│       └── translate-text.use-case.ts          # NEW: Core translation orchestration
│
├── infrastructure/
│   └── services/
│       └── gemini-translation.service.ts       # NEW: Google Gemini API integration
│
└── presentation/
    ├── controllers/
    │   └── translation.controller.ts           # NEW: Request handling
    ├── dto/
    │   ├── translate-request.dto.ts            # NEW: Input validation
    │   └── translate-response.dto.ts           # NEW: Response formatting
    ├── middleware/
    │   └── [reuse existing validation/error]
    └── routes/
        └── translation.routes.ts               # NEW: Route configuration

tests/
├── integration/
│   └── translation-api.integration.test.ts     # NEW: E2E API tests
└── unit/
    ├── translate-text.use-case.test.ts         # NEW: Use case unit tests
    └── gemini-translation.service.test.ts      # NEW: Service unit tests

config/
└── .env.example                                # UPDATE: Add GEMINI_API_KEY
```

**Structure Decision**: Single project using Clean Architecture pattern. This feature adds a new vertical slice (translation) following the existing pattern used for document conversion. All new files integrate into the existing layer structure without modifying the overall architecture.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - This feature introduces no additional complexity beyond the established Clean Architecture patterns.

---

## Post-Design Constitution Re-Check

*Re-evaluation after Phase 1 design artifacts completed*

### Design Artifacts Review

**Artifacts Generated**:
- ✅ research.md: Technology choices documented with rationale
- ✅ data-model.md: Domain entities and DTOs defined
- ✅ contracts/api.openapi.yaml: Complete OpenAPI 3.0 specification
- ✅ quickstart.md: Developer onboarding guide with examples

### Architecture Validation

**Clean Architecture Compliance** (Re-verified):
- ✅ **Domain Layer**: Pure entities (TranslationItem, TranslationJob, TranslatedItem) with no external dependencies
- ✅ **Application Layer**: Use case (TranslateTextUseCase) orchestrates business logic, interface (ITranslationService) defines contracts
- ✅ **Infrastructure Layer**: Service (GeminiTranslationService) implements external API integration
- ✅ **Presentation Layer**: Controller, routes, DTOs handle HTTP concerns, validation middleware

**Dependency Rule** (Re-verified):
- Domain entities have zero external dependencies
- Application layer depends only on domain
- Infrastructure implements application interfaces
- Presentation depends on application use cases

**Design Quality**:
- ✅ **Single Responsibility**: Each component has one clear purpose
- ✅ **Interface Segregation**: ITranslationService has focused contract
- ✅ **Dependency Inversion**: Use case depends on abstraction, not concrete implementation
- ✅ **Testability**: All components can be tested in isolation with mocks

### TypeScript Best Practices (Re-verified)

- ✅ **Type Safety**: All entities and DTOs have strict type definitions
- ✅ **Immutability**: Domain entities use readonly properties
- ✅ **Error Types**: Custom error classes for domain-specific failures
- ✅ **Validation**: DTOs use class-validator decorators (existing pattern)

### API Design Standards (Re-verified)

- ✅ **OpenAPI Specification**: Complete with schemas, examples, error responses
- ✅ **HTTP Semantics**: Correct use of POST method, status codes (200, 400, 413, 422, 503, 504)
- ✅ **Error Responses**: Consistent structure with machine-readable codes
- ✅ **Documentation**: Request/response examples, error scenarios covered

### New Dependencies Assessment

**Added Dependencies**:
1. **@google/genai v1.25.0**: Official Google SDK, well-maintained, necessary for Gemini API
2. **iso-639-1 v3.1.5**: Standard language validation, 325K+ weekly downloads, stable
3. **exponential-backoff**: Retry logic, 325K+ weekly downloads, minimal footprint

**Justification**: All dependencies are necessary, well-maintained, and follow npm ecosystem best practices. No unnecessary abstractions added.

### Performance & Constraints Validation

- ✅ **Token Counting**: Pre-validation before API calls to fail fast
- ✅ **Timeout Handling**: 30s timeout configured to prevent hanging requests
- ✅ **Rate Limiting**: Client-side queuing strategy documented for free tier (5 RPM)
- ✅ **Error Handling**: Exponential backoff with retry logic for transient failures

### Testing Strategy Validation

- ✅ **Unit Tests**: Use cases and services tested in isolation
- ✅ **Integration Tests**: API endpoint E2E tests with real HTTP calls
- ✅ **Contract Tests**: OpenAPI spec serves as contract for API behavior
- ✅ **Mocking Strategy**: External Gemini API calls mocked in unit tests

### Documentation Completeness

- ✅ **Quickstart Guide**: Complete with curl examples, JavaScript client, error handling
- ✅ **Data Model**: All entities, DTOs, validation rules documented
- ✅ **API Contract**: Full OpenAPI spec with request/response examples
- ✅ **Research**: Technology choices justified with alternatives considered

---

**Final Status**: ✅ **PASSED POST-DESIGN REVIEW**

The design maintains Clean Architecture principles, introduces no unnecessary complexity, and follows established TypeScript and API best practices. All new dependencies are justified and necessary. The feature is ready for task generation and implementation.
