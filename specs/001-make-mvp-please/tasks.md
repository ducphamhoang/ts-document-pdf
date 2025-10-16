# Tasks: Document to PDF Conversion Service

**Input**: Design documents from `/specs/001-make-mvp-please/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are NOT included in this task list as testing was not explicitly requested in the feature specification. Tests can be added later if needed.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, Setup, Foundation)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root (as per plan.md)
- All file paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure needed for all user stories

- [ ] T001 [Setup] Create project directory structure: `src/{domain,application,infrastructure,presentation}`, `tests/{unit,integration,fixtures}`, `config/`, `docs/`
- [ ] T002 [Setup] Initialize Node.js TypeScript project: Create `package.json` with name, version, scripts (dev, build, start, test)
- [ ] T003 [P] [Setup] Configure TypeScript: Create `tsconfig.json` with strict mode, path aliases (@domain, @application, @infrastructure, @presentation), ES2022 target
- [ ] T004 [P] [Setup] Install core dependencies: `npm install express multer dotenv winston` (production dependencies)
- [ ] T005 [P] [Setup] Install dev dependencies: `npm install -D typescript @types/node @types/express @types/multer ts-node-dev jest @types/jest supertest @types/supertest eslint prettier`
- [ ] T006 [P] [Setup] Configure ESLint and Prettier: Create `.eslintrc.json` and `.prettierrc` with TypeScript rules
- [ ] T007 [P] [Setup] Create environment config template: `config/.env.example` with PORT, BASE_URL, MAX_FILE_SIZE_MB, FILE_RETENTION_HOURS, CONVERSION_TIMEOUT_MS, MAX_CONCURRENT_CONVERSIONS, LOG_LEVEL
- [ ] T008 [P] [Setup] Create .gitignore: Include node_modules/, dist/, .env, logs/, *.log, coverage/

**Checkpoint**: Project structure is ready, dependencies installed, and configuration templates created

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 [Foundation] Create domain error classes in `src/domain/errors/`: Base `DomainError`, `ValidationError`, `UnsupportedFileTypeError`, `FileTooLargeError`, `InvalidFileSignatureError`, `ConversionFailedError`, `ConversionTimeoutError`, `FileNotFoundError`
- [ ] T010 [P] [Foundation] Create domain entities in `src/domain/entities/uploaded-document.entity.ts`: Define `UploadedDocument` interface with id, originalFilename, mimeType, sizeBytes, tempPath, uploadedAt, fileExtension
- [ ] T011 [P] [Foundation] Create domain entities in `src/domain/entities/converted-pdf.entity.ts`: Define `ConvertedPDF` interface with id, originalDocumentId, filename, sizeBytes, tempPath, downloadUrl, createdAt, expiresAt, downloadCount
- [ ] T012 [P] [Foundation] Create domain entities in `src/domain/entities/conversion-job.entity.ts`: Define `ConversionJob` interface and `ConversionStatus` enum (queued, processing, completed, failed)
- [ ] T013 [P] [Foundation] Create application interfaces in `src/application/interfaces/file-converter.interface.ts`: Define `IFileConverter` interface with `convert(inputPath: string, outputDir: string): Promise<string>` method
- [ ] T014 [P] [Foundation] Create application interfaces in `src/application/interfaces/storage.interface.ts`: Define `IStorage` interface with methods: `createTempDirectory()`, `savePDF()`, `getPDF()`, `deletePDF()`, `cleanup()`
- [ ] T015 [P] [Foundation] Create application interfaces in `src/application/interfaces/file-validator.interface.ts`: Define `IFileValidator` interface with `validateFile(file: Express.Multer.File): Promise<void>` method
- [ ] T016 [Foundation] Create infrastructure config loader in `src/infrastructure/config/index.ts`: Load environment variables with dotenv, export typed config object (port, files, conversion, server settings)
- [ ] T017 [P] [Foundation] Create Winston logger in `src/infrastructure/logger/winston.logger.ts`: Configure console and file transports, structured JSON format, log levels
- [ ] T018 [Foundation] Create centralized error middleware in `src/presentation/middleware/error.middleware.ts`: Map domain errors to HTTP status codes (400, 413, 415, 422, 504), return consistent JSON error responses
- [ ] T019 [P] [Foundation] Create logging middleware in `src/presentation/middleware/logging.middleware.ts`: Log request method, path, status code, response time for all API requests
- [ ] T020 [P] [Foundation] Create DTO schemas in `src/presentation/dto/convert-response.dto.ts`: Define `ConvertSuccessResponse` and `ConvertErrorResponse` interfaces
- [ ] T021 [Foundation] Create Express server setup in `src/server.ts`: Initialize Express app, configure middleware (helmet, cors, logging), setup error handler, export app instance
- [ ] T022 [Foundation] Create application entry point in `src/index.ts`: Import server, start listening on configured port, handle process signals for graceful shutdown

**Checkpoint**: Foundation ready - all core infrastructure, error handling, logging, and server setup complete. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Upload and Convert Office Document (Priority: P1) 🎯 MVP

**Goal**: Enable developers to upload DOCX/XLSX/PPTX files and receive a download link for the converted PDF

**Independent Test**: Send POST request to `/api/v1/convert` with a valid office document file, verify response contains a download URL with unique UUID

**Implementation Sequence**: Validation → Storage → Conversion → Use Case → Controller → Route

### Implementation for User Story 1

- [ ] T023 [P] [US1] Implement file validator service in `src/infrastructure/services/file-validator.service.ts`: Validate MIME type (DOCX/XLSX/PPTX), file size (<25MB), file signature (magic bytes check using `file-type` package)
- [ ] T024 [P] [US1] Implement temp file storage service in `src/infrastructure/services/temp-file-storage.service.ts`: Create unique temp directories with `fs.mkdtemp`, save uploaded files, manage file lifecycle, implement `IStorage` interface
- [ ] T025 [US1] Implement LibreOffice converter service in `src/infrastructure/services/libreoffice-converter.service.ts`: Execute `libreoffice --headless --convert-to pdf` using `child_process.execFile`, handle timeout (30s), capture stderr for errors, implement `IFileConverter` interface
- [ ] T026 [US1] Configure Multer for file uploads in `src/infrastructure/config/multer.config.ts`: Set size limit (25MB), configure temp storage, set file filter for allowed MIME types
- [ ] T027 [US1] Implement convert file use case in `src/application/use-cases/convert-file.use-case.ts`: Orchestrate validation → save upload → convert → create ConvertedPDF entity → return download URL. Constructor inject `IFileValidator`, `IStorage`, `IFileConverter`
- [ ] T028 [US1] Create conversion controller in `src/presentation/controllers/conversion.controller.ts`: Handle POST /convert request, extract file from multer, call convert use case, return success response with download URL or error response
- [ ] T029 [US1] Create conversion routes in `src/presentation/routes/conversion.routes.ts`: Define POST `/api/v1/convert` endpoint with multer middleware, wire to conversion controller, export router
- [ ] T030 [US1] Register conversion routes in `src/server.ts`: Import and mount conversion router at `/api/v1`, ensure error middleware is last in chain

**Checkpoint**: User Story 1 complete - developers can upload office documents and receive download links. This is the MVP!

---

## Phase 4: User Story 2 - Download Converted PDF (Priority: P1)

**Goal**: Enable users to download converted PDF files using the download URL from conversion response

**Independent Test**: Make GET request to `/downloads/:fileId` with a valid UUID from a previous conversion, verify PDF file is returned with correct headers (Content-Type, Content-Disposition, filename)

**Implementation Sequence**: Use Case → Controller → Route Integration

### Implementation for User Story 2

- [ ] T031 [US2] Implement download file use case in `src/application/use-cases/download-file.use-case.ts`: Look up ConvertedPDF by ID, check if expired, increment download count, return file path and metadata. Constructor inject `IStorage`
- [ ] T032 [US2] Add download handler to conversion controller in `src/presentation/controllers/conversion.controller.ts`: Handle GET /downloads/:fileId request, call download use case, stream PDF file with correct headers (Content-Type: application/pdf, Content-Disposition with filename), handle 404 for expired/missing files
- [ ] T033 [US2] Add download route in `src/presentation/routes/conversion.routes.ts`: Define GET `/downloads/:fileId` endpoint, wire to download handler in conversion controller
- [ ] T034 [US2] Create in-memory storage for converted PDFs in `src/infrastructure/services/temp-file-storage.service.ts`: Add Map<string, ConvertedPDF> to track active PDFs, implement lookup by ID, calculate expiration (createdAt + retention hours)

**Checkpoint**: User Stories 1 AND 2 complete - full conversion workflow functional (upload → convert → download). Core MVP ready for deployment.

---

## Phase 5: User Story 3 - Automatic Cleanup of Temporary Files (Priority: P2)

**Goal**: Automatically delete expired temporary files to prevent disk overflow and ensure data privacy

**Independent Test**: Convert a file, set FILE_RETENTION_HOURS=0.01 (36 seconds), wait for cleanup interval, attempt download and verify 404 response

**Implementation Sequence**: Cleanup Service → Scheduler Integration

### Implementation for User Story 3

- [ ] T035 [US3] Implement file cleanup service in `src/infrastructure/services/file-cleanup.service.ts`: Find expired ConvertedPDFs (expiresAt < now), delete files from file system, remove from in-memory Map, log deletion events
- [ ] T036 [US3] Add scheduled cleanup to server initialization in `src/index.ts`: Use `setInterval` to run cleanup service every 15 minutes (configurable), handle cleanup errors gracefully without crashing server
- [ ] T037 [US3] Add startup cleanup in `src/index.ts`: On server start, scan temp directory (`/tmp/convert-*`) and remove stale directories from previous server runs, log cleanup results

**Checkpoint**: User Stories 1, 2, AND 3 complete - system is production-ready with automatic cleanup preventing storage issues.

---

## Phase 6: User Story 4 - Handle Invalid File Submissions (Priority: P2)

**Goal**: Provide clear, actionable error messages for invalid file submissions (wrong type, too large, missing, corrupted)

**Independent Test**: Submit invalid inputs (PDF file, 26MB file, no file, corrupted DOCX) and verify appropriate error responses (415, 413, 400, 422) with descriptive messages

**Implementation Sequence**: Validation Enhancement → Error Handling

### Implementation for User Story 4

- [ ] T038 [US4] Enhance file validator in `src/infrastructure/services/file-validator.service.ts`: Add detailed error messages for each validation failure (unsupported type with list of supported formats, size limit with actual size, signature mismatch details)
- [ ] T039 [US4] Add validation middleware in `src/presentation/middleware/validation.middleware.ts`: Check for missing file field before multer processes request, return 400 with clear "File is required in 'file' field" message
- [ ] T040 [US4] Update multer config error handling in `src/infrastructure/config/multer.config.ts`: Configure multer to throw `FileTooLargeError` for size violations (413), `UnsupportedFileTypeError` for MIME type mismatches (415)
- [ ] T041 [US4] Add timeout handling to LibreOffice converter in `src/infrastructure/services/libreoffice-converter.service.ts`: Wrap `execFile` with timeout (30s), throw `ConversionTimeoutError` (504) if exceeded, throw `ConversionFailedError` (422) for non-zero exit codes with stderr details
- [ ] T042 [US4] Update error middleware in `src/presentation/middleware/error.middleware.ts`: Ensure all domain errors map to correct HTTP status codes and include helpful error messages (no internal details like stack traces in production)

**Checkpoint**: User Stories 1-4 complete - system has robust error handling with user-friendly messages for all failure scenarios.

---

## Phase 7: User Story 5 - Handle High Concurrent Load (Priority: P3)

**Goal**: Maintain responsiveness and stability under high concurrent load without rejecting requests

**Independent Test**: Send 10 concurrent conversion requests using a load testing tool, verify all complete successfully with acceptable response times (<15s for 95th percentile)

**Implementation Sequence**: Queue Management → Concurrency Control

### Implementation for User Story 5

- [ ] T043 [US5] Create conversion queue manager in `src/infrastructure/services/conversion-queue.service.ts`: Implement simple in-memory queue (array) to track pending conversion jobs, limit concurrent LibreOffice processes to MAX_CONCURRENT_CONVERSIONS (default: 5)
- [ ] T044 [US5] Add queue integration to convert use case in `src/application/use-cases/convert-file.use-case.ts`: Before conversion, check queue capacity. If at limit, enqueue job and process when slot available. Update ConversionJob status (queued → processing → completed/failed)
- [ ] T045 [US5] Add concurrency tracking to LibreOffice converter in `src/infrastructure/services/libreoffice-converter.service.ts`: Track active conversion count, implement semaphore pattern to limit concurrent executions, queue excess requests
- [ ] T046 [US5] Add queue metrics logging in `src/infrastructure/services/conversion-queue.service.ts`: Log queue length, wait time, and concurrent conversion count for monitoring

**Checkpoint**: All 5 user stories complete - system is production-ready with robust concurrency handling for high-load scenarios.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and overall system quality

- [ ] T047 [P] [Polish] Add API documentation: Create `README.md` at repository root with quick start guide, API endpoints, example requests/responses, environment variables reference
- [ ] T048 [P] [Polish] Add sample test fixtures: Create `tests/fixtures/` with sample.docx, sample.xlsx, sample.pptx, corrupted.docx, large-file.docx for manual testing
- [ ] T049 [P] [Polish] Create health check endpoint in `src/presentation/routes/health.routes.ts`: Add GET `/health` endpoint returning { status: "ok", service: "Document to PDF Conversion API", version: "1.0.0" }
- [ ] T050 [P] [Polish] Add request ID middleware in `src/presentation/middleware/logging.middleware.ts`: Generate UUID for each request, add to response headers (X-Request-ID), include in all log messages for traceability
- [ ] T051 [Polish] Add graceful shutdown handling in `src/index.ts`: On SIGTERM/SIGINT, stop accepting new requests, wait for active conversions to complete (with timeout), clean up resources, exit cleanly
- [ ] T052 [P] [Polish] Optimize LibreOffice process management in `src/infrastructure/services/libreoffice-converter.service.ts`: Add process pooling to reuse LibreOffice instances instead of spawning new process per conversion (performance improvement)
- [ ] T053 [P] [Polish] Add input sanitization for filenames in `src/infrastructure/services/temp-file-storage.service.ts`: Remove path traversal characters (../, ..\), limit filename length (255 chars), handle unicode characters safely
- [ ] T054 [Polish] Run validation against quickstart.md: Execute all example commands from `specs/001-make-mvp-please/quickstart.md`, verify they work as documented, update any discrepancies
- [ ] T055 [P] [Polish] Add OpenAPI/Swagger UI (optional): Install `swagger-ui-express`, serve OpenAPI spec from `specs/001-make-mvp-please/contracts/api.openapi.yaml` at `/api-docs` endpoint for interactive API documentation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundation - No dependencies on other stories ✅ MVP START
  - User Story 2 (P1): Can start after Foundation - No dependencies on other stories (but enhances US1)
  - User Story 3 (P2): Depends on US1 + US2 completion (needs ConvertedPDF entities created)
  - User Story 4 (P2): Can start after Foundation - Enhances US1 error handling (can develop in parallel with US1)
  - User Story 5 (P3): Depends on US1 completion (adds queue management to conversion flow)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Foundation (Phase 2) - BLOCKING
    ↓
    ├──> User Story 1 (P1) - Upload & Convert [MVP] ← Independent
    │       ↓
    │       └──> User Story 5 (P3) - Concurrency [Depends on US1]
    │
    ├──> User Story 2 (P1) - Download [MVP] ← Independent (enhances US1)
    │
    ├──> User Story 3 (P2) - Cleanup [Depends on US1+US2]
    │       └──> (Needs ConvertedPDF entities)
    │
    └──> User Story 4 (P2) - Error Handling ← Independent (can parallel with US1)
            └──> (Enhances US1 validation)
```

### Within Each User Story

- **User Story 1**: Validation → Storage → Conversion → Use Case → Controller → Route (sequential, depends on order)
- **User Story 2**: Use Case → Controller → Route Integration (sequential)
- **User Story 3**: Cleanup Service → Scheduler (sequential)
- **User Story 4**: All tasks can run in parallel (different aspects of error handling)
- **User Story 5**: Queue Manager → Use Case Integration → Converter Integration (sequential)

### Parallel Opportunities

#### Phase 1 (Setup)
All tasks marked [P] can run in parallel:
- T003 (tsconfig), T004 (prod deps), T005 (dev deps), T006 (linting), T007 (.env), T008 (.gitignore)

#### Phase 2 (Foundation)
Parallel groups:
- **Group A** (Domain entities): T010, T011, T012 - all parallel [P]
- **Group B** (Interfaces): T013, T014, T015 - all parallel [P]
- **Group C** (Infrastructure): T017 (logger), T019 (logging middleware), T020 (DTOs) - all parallel [P]
- Sequential: T009 (errors first) → T016 (config) → T018 (error middleware) → T021 (server) → T022 (index)

#### Phase 3 (User Story 1)
Parallel at start:
- T023 (validator) and T024 (storage) can run in parallel [P]
- Then T025 (converter), T026 (multer config) sequential
- Then T027 (use case) → T028 (controller) → T029 (routes) → T030 (integration) sequential

#### Phase 8 (Polish)
All tasks marked [P] can run in parallel:
- T047 (docs), T048 (fixtures), T049 (health), T050 (request ID), T052 (optimization), T053 (sanitization), T055 (swagger)

---

## Parallel Example: User Story 1 (Core MVP)

```bash
# After Foundation phase completes, launch these in parallel to start US1:
Task T023: "Implement file validator service in src/infrastructure/services/file-validator.service.ts"
Task T024: "Implement temp file storage service in src/infrastructure/services/temp-file-storage.service.ts"

# Once T023 and T024 complete, continue sequentially:
Task T025: "Implement LibreOffice converter service" (depends on storage for temp dirs)
Task T026: "Configure Multer" (depends on validator for file filter)
Task T027: "Implement convert file use case" (depends on all services)
Task T028: "Create conversion controller" (depends on use case)
Task T029: "Create conversion routes" (depends on controller)
Task T030: "Register routes in server" (final integration)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only) - Recommended

**Delivers**: Core conversion functionality - upload office documents, get PDF download links

1. ✅ Complete Phase 1: Setup (T001-T008)
2. ✅ Complete Phase 2: Foundational (T009-T022) - CRITICAL BLOCKING PHASE
3. ✅ Complete Phase 3: User Story 1 (T023-T030) - Upload & Convert
4. ✅ Complete Phase 4: User Story 2 (T031-T034) - Download PDFs
5. **🎯 STOP and VALIDATE**: Test full workflow (upload → convert → download)
6. Deploy/demo MVP

**At this point you have a working product!**

### Incremental Delivery (Add Stories One by One)

1. Foundation ready (Phases 1-2) → Enable all future work
2. Add User Story 1 + 2 → Test independently → Deploy MVP ✅
3. Add User Story 3 (Cleanup) → Test independently → Redeploy
4. Add User Story 4 (Error Handling) → Test independently → Redeploy
5. Add User Story 5 (Concurrency) → Test independently → Redeploy
6. Polish phase → Final production hardening

Each story adds value without breaking previous functionality.

### Parallel Team Strategy (If Multiple Developers)

With 3+ developers:

1. **Together**: Complete Setup + Foundational (Phases 1-2)
2. **Once Foundational is done, split work**:
   - Developer A: User Story 1 (T023-T030) - Core conversion
   - Developer B: User Story 2 (T031-T034) - Download
   - Developer C: User Story 4 (T038-T042) - Error handling (can parallel with US1)
3. **After US1+US2 complete**:
   - Developer A: User Story 3 (T035-T037) - Cleanup
   - Developer B: User Story 5 (T043-T046) - Concurrency
   - Developer C: Polish tasks (T047-T055)
4. Stories integrate independently

---

## Task Summary

**Total Tasks**: 55 tasks across 8 phases

### Task Count by Phase
- Phase 1 (Setup): 8 tasks
- Phase 2 (Foundational): 14 tasks ⚠️ BLOCKING
- Phase 3 (US1 - Upload & Convert): 8 tasks 🎯 MVP
- Phase 4 (US2 - Download): 4 tasks 🎯 MVP
- Phase 5 (US3 - Cleanup): 3 tasks
- Phase 6 (US4 - Error Handling): 5 tasks
- Phase 7 (US5 - Concurrency): 4 tasks
- Phase 8 (Polish): 9 tasks

### Task Count by User Story
- **User Story 1** (Upload & Convert): 8 implementation tasks
- **User Story 2** (Download PDFs): 4 implementation tasks
- **User Story 3** (Cleanup): 3 implementation tasks
- **User Story 4** (Error Handling): 5 implementation tasks
- **User Story 5** (Concurrency): 4 implementation tasks
- **Setup/Foundation/Polish**: 31 supporting tasks

### Parallel Opportunities Identified
- **Setup Phase**: 6 tasks can run in parallel (T003-T008)
- **Foundation Phase**: 9 tasks can run in parallel in groups (entities, interfaces, infrastructure)
- **User Story 1**: 2 tasks can start in parallel (validator + storage)
- **User Story 4**: 5 tasks can run in parallel (different error scenarios)
- **Polish Phase**: 7 tasks can run in parallel (T047-T050, T052-T053, T055)

**Total parallel opportunities**: ~29 tasks can run concurrently with proper task distribution

### Independent Test Criteria per Story

- **US1**: POST to `/api/v1/convert` with DOCX → receive download URL with UUID
- **US2**: GET to `/downloads/:uuid` → receive PDF with correct headers
- **US3**: Convert file, wait past retention period → GET returns 404
- **US4**: Submit invalid files → receive appropriate HTTP errors (400/413/415/422)
- **US5**: Send 10 concurrent requests → all complete successfully

### Suggested MVP Scope

**Minimum MVP**: Phases 1 + 2 + 3 + 4 (22 tasks)
- Complete foundation
- User Story 1: Upload and convert documents
- User Story 2: Download converted PDFs
- **Result**: Functional conversion service for manual testing/validation

**Recommended MVP**: Add Phase 5 (User Story 3 - Cleanup) (25 tasks)
- Prevents disk overflow in production
- Essential for any deployment beyond testing

---

## Notes

- **[P] tasks** = different files, no dependencies - can run in parallel
- **[Story] label** maps task to specific user story for traceability and independent testing
- Each user story is independently testable after its phase completes
- **No test tasks included** - testing was not explicitly requested in feature specification
- Commit after each task or logical group of related tasks
- Stop at any checkpoint to validate story independently
- **Foundation phase (Phase 2) is CRITICAL** - nothing can proceed until it's complete
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
- All file paths assume single project structure from plan.md (src/, tests/ at repository root)
