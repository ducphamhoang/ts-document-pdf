# Implementation Plan: Document to PDF Conversion Service

**Branch**: `001-make-mvp-please` | **Date**: 2025-10-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-make-mvp-please/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature implements a Document to PDF Conversion Service that accepts office documents (DOCX, XLSX, PPTX) via a REST API endpoint, converts them to PDF using LibreOffice CLI, and returns temporary download links. The service prioritizes simplicity, security, and reliability for developers integrating document conversion into their applications. The architecture follows Clean Architecture principles with clear separation between domain logic, application use cases, infrastructure implementations, and API presentation layers.

## Technical Context

**Language/Version**: Node.js with TypeScript (latest LTS - Node 20.x, TypeScript 5.x)
**Primary Dependencies**: Express.js (web framework), Multer (file upload handling), LibreOffice CLI (conversion engine)
**Storage**: File system (temporary directory) - no database required for MVP
**Testing**: Jest (unit + integration testing)
**Target Platform**: Linux server (LibreOffice CLI dependency)
**Project Type**: Single backend API service (no frontend)
**Performance Goals**: 10-second conversion time for 5MB files (95th percentile), 100 concurrent requests without degradation
**Constraints**: <500ms API response time (excluding conversion), <25MB file size limit, 1-hour file retention
**Scale/Scope**: MVP targets 1000 conversions/day, 3 supported file formats (DOCX/XLSX/PPTX), single conversion endpoint + download endpoint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS - No constitution violations (using template/default principles)

The project constitution is currently in template form. Based on the agent-dev.md guidelines and feature requirements, the following principles are implicitly applied:

### Implicit Principles from agent-dev.md

1. **Clean Architecture**: ✅ PASS
   - Four-layer separation: Domain → Application → Infrastructure → Presentation
   - Dependencies point inward (infrastructure depends on abstractions, not vice versa)
   - Testability via dependency inversion

2. **Simplicity First**: ✅ PASS
   - Single API service (no microservices complexity)
   - No authentication/authorization for MVP
   - File system storage (no distributed storage)
   - No queue system initially (direct processing)

3. **Security by Design**: ✅ PASS
   - File validation (MIME type + size)
   - Temporary storage with unique identifiers
   - Input sanitization for filenames
   - Automatic cleanup to prevent data accumulation
   - Use of execFile/spawn instead of exec to prevent shell injection

4. **Type Safety**: ✅ PASS
   - TypeScript strict mode enabled
   - Interface-based abstractions
   - No `any` types

### Post-Design Re-Evaluation (Phase 1 Complete)

**Status**: ✅ PASS - All principles maintained after detailed design

After completing research, data modeling, and API contract design:

1. **Clean Architecture**: ✅ MAINTAINED
   - Entity model clearly separates domain logic (UploadedDocument, ConvertedPDF, ConversionJob)
   - Interface abstractions defined (IFileConverter, IStorage, IFileValidator)
   - Use cases remain framework-agnostic (no Express dependencies)

2. **Simplicity First**: ✅ MAINTAINED
   - Data model uses in-memory Maps for MVP (acceptable trade-off documented)
   - API contract uses standard REST with 2 endpoints (POST /convert, GET /downloads/:id)
   - No additional complexity introduced

3. **Security by Design**: ✅ MAINTAINED
   - File validation strategy confirmed (multi-layer: size → MIME → signature)
   - Unique UUID download URLs prevent enumeration
   - Error responses don't leak internal details

4. **Type Safety**: ✅ MAINTAINED
   - All entities defined with readonly properties and TypeScript interfaces
   - Enum for ConversionStatus ensures type-safe state transitions
   - Custom error classes maintain type information

### Potential Future Constitution Items

The following would be good candidates for formalizing in a project constitution:

- **Test-First Development**: All use cases require tests before implementation
- **Error Handling Standard**: Centralized error middleware with custom error classes
- **Configuration Management**: All environment-specific values in config files
- **Dependency Injection**: Constructor-based DI for testability

## Project Structure

### Documentation (this feature)

```
specs/001-make-mvp-please/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── api.openapi.yaml # OpenAPI 3.0 specification
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── domain/
│   ├── entities/
│   │   ├── uploaded-document.entity.ts    # Uploaded document entity
│   │   ├── converted-pdf.entity.ts        # Converted PDF entity
│   │   └── conversion-job.entity.ts       # Conversion job tracking
│   └── errors/
│       ├── validation.error.ts            # Custom error: validation failures
│       ├── unsupported-file.error.ts      # Custom error: unsupported file type
│       ├── conversion-failed.error.ts     # Custom error: conversion failures
│       └── file-not-found.error.ts        # Custom error: file not found
│
├── application/
│   ├── interfaces/
│   │   ├── file-converter.interface.ts    # Abstraction for conversion
│   │   ├── storage.interface.ts           # Abstraction for file storage
│   │   └── file-validator.interface.ts    # Abstraction for file validation
│   └── use-cases/
│       ├── convert-file.use-case.ts       # UC: Upload + convert document
│       └── download-file.use-case.ts      # UC: Retrieve converted PDF
│
├── infrastructure/
│   ├── services/
│   │   ├── libreoffice-converter.service.ts    # LibreOffice CLI implementation
│   │   ├── temp-file-storage.service.ts        # File system storage implementation
│   │   ├── file-validator.service.ts           # MIME type + size validation
│   │   └── file-cleanup.service.ts             # Automatic file deletion
│   ├── config/
│   │   ├── index.ts                            # Environment config loader
│   │   ├── multer.config.ts                    # File upload configuration
│   │   └── app.config.ts                       # Application settings
│   └── logger/
│       └── winston.logger.ts                   # Structured logging
│
├── presentation/
│   ├── controllers/
│   │   └── conversion.controller.ts       # HTTP request handlers
│   ├── routes/
│   │   └── conversion.routes.ts           # API route definitions
│   ├── middleware/
│   │   ├── error.middleware.ts            # Centralized error handler
│   │   ├── validation.middleware.ts       # Request validation
│   │   └── logging.middleware.ts          # Request/response logging
│   └── dto/
│       ├── convert-request.dto.ts         # Request data transfer object
│       └── convert-response.dto.ts        # Response data transfer object
│
├── server.ts                              # Express server setup
└── index.ts                               # Application entry point

tests/
├── unit/
│   ├── domain/
│   │   └── entities/                      # Entity unit tests
│   ├── application/
│   │   └── use-cases/                     # Use case unit tests
│   └── infrastructure/
│       └── services/                      # Service unit tests
│
├── integration/
│   ├── api/
│   │   ├── convert.api.test.ts            # Conversion endpoint integration tests
│   │   └── download.api.test.ts           # Download endpoint integration tests
│   └── services/
│       └── libreoffice.integration.test.ts # LibreOffice CLI integration tests
│
└── fixtures/
    ├── sample.docx                        # Test document fixtures
    ├── sample.xlsx
    ├── sample.pptx
    ├── corrupted.docx
    └── large-file.docx

config/
└── .env.example                           # Example environment variables

docs/
├── prd-mvp.md                            # Product requirements (existing)
└── agent-dev.md                          # Development guidelines (existing)
```

**Structure Decision**:

This is a **single project** (Option 1) architecture since we're building a backend API service without a frontend. The structure follows Clean Architecture with:

- **Domain Layer**: Core business entities and domain-specific errors
- **Application Layer**: Use cases orchestrating business logic + interface abstractions
- **Infrastructure Layer**: Concrete implementations of external concerns (LibreOffice, file system, logging)
- **Presentation Layer**: HTTP API layer with Express.js (routes, controllers, middleware, DTOs)

The test structure mirrors the source structure with clear separation between unit tests (testing components in isolation) and integration tests (testing API endpoints and external service integration).

## Complexity Tracking

*No violations detected - this section is not required.*

The architecture follows straightforward patterns appropriate for an MVP:
- Single API service (no distributed systems complexity)
- File system storage (no database/ORM complexity)
- Direct conversion processing (no queue system initially)
- Constructor-based DI (no DI container framework)
- Standard REST API (no GraphQL/gRPC complexity)
