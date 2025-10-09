# Research: Document to PDF Conversion Service

**Feature**: Document to PDF Conversion Service
**Branch**: `001-make-mvp-please`
**Date**: 2025-10-10

## Overview

This document consolidates research findings for key technical decisions and best practices for implementing the Document to PDF Conversion Service MVP. The research addresses LibreOffice CLI integration, file validation strategies, error handling patterns, and TypeScript/Node.js best practices.

---

## 1. LibreOffice CLI Integration

### Decision: Use `child_process.execFile` with timeout and error handling

### Rationale

LibreOffice headless mode provides reliable document conversion via command-line interface without requiring a desktop environment. The `execFile` approach provides:

1. **Security**: No shell injection vulnerabilities (vs `exec`)
2. **Control**: Direct argument passing without shell interpretation
3. **Timeout Support**: Built-in timeout mechanism to prevent hanging processes
4. **Error Detection**: Stderr capture for conversion failures

### Implementation Pattern

```bash
libreoffice --headless --convert-to pdf --outdir <output-dir> <input-file>
```

**Key Parameters**:
- `--headless`: Run without GUI
- `--convert-to pdf`: Target format
- `--outdir`: Output directory for converted file
- Input file path as final argument

**Timeout Recommendation**: 30 seconds for standard files, 60 seconds for large files (configurable)

**Error Handling**:
- Exit code 0 = success
- Non-zero exit code = conversion failure
- Stderr contains error details (malformed file, missing fonts, etc.)

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **PDF generation libraries** (e.g., puppeteer, jsPDF) | Cannot parse DOCX/XLSX/PPTX native formats; would require parsing complex binary formats |
| **Cloud conversion APIs** (e.g., CloudConvert) | Introduces external dependency, costs, and data privacy concerns for MVP |
| **LibreOffice UNO API** | More complex setup; requires Python/Java bindings; overkill for simple conversion |
| **child_process.exec** | Security risk: shell injection vulnerabilities with unsanitized filenames |

### Best Practices

1. **Sanitize file paths**: Use absolute paths from `fs.mkdtemp` to avoid path traversal
2. **Validate output**: Check that output PDF exists after conversion
3. **Resource cleanup**: Always remove input and output files in finally blocks
4. **Concurrency limit**: Limit concurrent LibreOffice processes (recommend: 5-10 max)
5. **Timeout configuration**: Environment variable for adjustable timeout based on typical file complexity

---

## 2. File Validation Strategy

### Decision: Multi-layer validation (MIME type + file signature + size)

### Rationale

Client-provided metadata (file extension, Content-Type header) cannot be trusted. A comprehensive validation strategy prevents:
- Malicious file uploads (e.g., executables disguised as documents)
- Server resource exhaustion (oversized files)
- Conversion failures from unsupported formats

### Validation Layers

**Layer 1: File Size Check** (pre-upload via Multer)
```typescript
multer({ limits: { fileSize: 25 * 1024 * 1024 } }) // 25MB
```

**Layer 2: MIME Type Check** (Multer filter)
```typescript
fileFilter: (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new UnsupportedFileTypeError());
  }
}
```

**Layer 3: File Signature Verification** (post-upload)
- Use `file-type` npm package to inspect magic bytes
- DOCX/XLSX/PPTX are ZIP archives starting with `PK\x03\x04`
- Reject files where signature doesn't match MIME type

### Error Responses

| Validation Failure | HTTP Status | Error Message |
|-------------------|-------------|---------------|
| File too large | 413 Payload Too Large | "File size exceeds 25MB limit" |
| Missing file | 400 Bad Request | "File is required in 'file' field" |
| Unsupported MIME | 415 Unsupported Media Type | "Supported formats: DOCX, XLSX, PPTX" |
| Invalid signature | 422 Unprocessable Entity | "File content does not match declared type" |

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Extension-only check** | Trivially bypassed by renaming files |
| **MIME type only** | Client-controlled; unreliable for security |
| **Full document parsing** | Performance overhead; LibreOffice will fail anyway if corrupted |
| **Antivirus scanning** | Out of scope for MVP; adds latency and complexity |

### Best Practices

1. **Fail fast**: Validate in order of computation cost (size → MIME → signature)
2. **Detailed error messages**: Help developers debug issues quickly
3. **Logging**: Log all validation failures for security monitoring
4. **Configurable limits**: Size limit as environment variable for different deployments

---

## 3. Temporary File Management

### Decision: OS temp directory + unique subdirectories per request

### Rationale

Temporary file management must be:
- **Secure**: Files not accessible via web server
- **Collision-free**: Multiple concurrent uploads don't overwrite each other
- **Self-cleaning**: Automatic removal prevents disk exhaustion

### Implementation Pattern

```typescript
const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'convert-'));
// tempDir = /tmp/convert-a1b2c3d4/

// Upload file: /tmp/convert-a1b2c3d4/input.docx
// Output file: /tmp/convert-a1b2c3d4/input.pdf
// Download URL: https://api.example.com/downloads/a1b2c3d4
```

**Unique Identifier**: Use `crypto.randomUUID()` for download URLs (maps to temp directory)

**Cleanup Strategy**:
1. **Immediate cleanup**: Delete temp directory after download completes (optional for MVP)
2. **Scheduled cleanup**: Cron job removes directories older than 1 hour
3. **Startup cleanup**: Remove stale temp directories on server restart

### File Retention Policy

- **Default**: 1 hour after conversion
- **Configurable**: Environment variable `FILE_RETENTION_HOURS`
- **One-time download** (optional): Delete immediately after first download

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Fixed temp directory** | Risk of filename collisions; harder to track which files belong together |
| **Database tracking** | Overkill for MVP; adds complexity without clear benefit |
| **Cloud storage (S3)** | External dependency; not required for MVP scale |
| **No cleanup** | Disk exhaustion; data privacy concerns |

### Best Practices

1. **Try-finally blocks**: Ensure cleanup even on errors
2. **Atomic operations**: Use `fs.rename` for atomic file moves
3. **Graceful degradation**: Log cleanup failures but don't crash
4. **Monitoring**: Track temp directory disk usage

---

## 4. Error Handling Architecture

### Decision: Custom error classes + centralized middleware

### Rationale

Clean Architecture principles require separating domain errors from HTTP concerns. Custom error classes:
- Express business rule violations (domain layer)
- Remain framework-agnostic (no HTTP in use cases)
- Enable consistent error responses (presentation layer)

### Error Class Hierarchy

```typescript
// Base domain error
class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific domain errors
class ValidationError extends DomainError {}
class UnsupportedFileTypeError extends DomainError {}
class ConversionFailedError extends DomainError {}
class FileNotFoundError extends DomainError {}
class ConversionTimeoutError extends DomainError {}
```

### Centralized Error Middleware

```typescript
// presentation/middleware/error.middleware.ts
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Map domain errors to HTTP responses
  const errorMap = {
    'ValidationError': 400,
    'UnsupportedFileTypeError': 415,
    'ConversionFailedError': 422,
    'FileNotFoundError': 404,
    'ConversionTimeoutError': 504
  };

  const statusCode = errorMap[err.name] || 500;

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
      type: err.name
    }
  });
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "File size exceeds 25MB limit",
    "type": "ValidationError"
  }
}
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **HTTP errors in use cases** | Violates Clean Architecture; couples business logic to HTTP |
| **Generic Error class** | Loses type information; harder to handle different cases |
| **Result<T, E> pattern** | More idiomatic in Rust; adds complexity in TypeScript |
| **Exception filters (NestJS)** | Not using NestJS framework for MVP |

### Best Practices

1. **Async error handling**: Wrap async route handlers to catch promise rejections
2. **Operational vs programmer errors**: Crash on programmer errors (bugs), handle operational errors gracefully
3. **Error logging**: Log stack traces for 500 errors, messages for 4xx errors
4. **Security**: Don't expose internal details (stack traces, file paths) in production

---

## 5. TypeScript Configuration

### Decision: Strict mode + Path aliases + ES2022 target

### Rationale

TypeScript's strict mode catches common bugs at compile time and enforces best practices. Path aliases improve import readability in Clean Architecture projects.

### Recommended tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@application/*": ["src/application/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@presentation/*": ["src/presentation/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Key Settings**:
- `strict: true`: Enables all strict type checks
- `esModuleInterop: true`: Better compatibility with CommonJS libraries
- `paths`: Alias absolute imports (requires `tsconfig-paths` or module aliasing)

### Path Alias Usage

```typescript
// Instead of: ../../../../domain/entities/uploaded-document.entity
import { UploadedDocument } from '@domain/entities/uploaded-document.entity';

// Instead of: ../../application/interfaces/file-converter.interface
import { IFileConverter } from '@application/interfaces/file-converter.interface';
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Loose mode** | Allows `any`, nullable bugs; defeats TypeScript purpose |
| **Relative imports** | Hard to read/maintain in deep directory structures |
| **ES modules (type: "module")** | Some libraries still have CommonJS compatibility issues |

---

## 6. Testing Strategy

### Decision: Jest with supertest for API tests + isolated unit tests

### Rationale

Jest provides a complete testing solution with built-in mocking, coverage reporting, and TypeScript support. Supertest enables integration testing of Express APIs without starting a real server.

### Test Categories

**Unit Tests** (tests/unit/)
- Domain entities: Business logic validation
- Use cases: Orchestration logic with mocked dependencies
- Services: Individual service methods with mocked external calls

**Integration Tests** (tests/integration/)
- API endpoints: Full request/response cycle with real file uploads
- LibreOffice integration: Actual conversion tests with sample documents

### Sample Test Structure

```typescript
// tests/integration/api/convert.api.test.ts
describe('POST /api/v1/convert', () => {
  it('should convert valid DOCX to PDF', async () => {
    const response = await request(app)
      .post('/api/v1/convert')
      .attach('file', 'tests/fixtures/sample.docx')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.downloadUrl).toMatch(/^https?:\/\/.+\/downloads\/.+$/);
  });

  it('should reject file larger than 25MB', async () => {
    const response = await request(app)
      .post('/api/v1/convert')
      .attach('file', 'tests/fixtures/large-file.docx')
      .expect(413);

    expect(response.body.error.message).toContain('25MB');
  });
});
```

### Coverage Goals

- **Unit tests**: 90%+ coverage for domain and application layers
- **Integration tests**: All happy paths + edge cases from spec

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Mocha + Chai** | More configuration; Jest provides batteries-included experience |
| **Vitest** | Newer; less mature ecosystem for Node.js backend testing |
| **No integration tests** | Cannot verify LibreOffice integration without actual conversion tests |

### Best Practices

1. **Fixtures**: Use real sample documents (DOCX/XLSX/PPTX) for realistic tests
2. **Cleanup**: Remove generated files after integration tests
3. **Mocking**: Mock external dependencies (LibreOffice) in unit tests
4. **Parallel execution**: Jest's default; significantly faster CI/CD builds

---

## 7. Logging and Observability

### Decision: Winston for structured logging with multiple transports

### Rationale

Structured logging enables:
- Production debugging (searchable logs)
- Security monitoring (track validation failures)
- Performance analysis (conversion times)
- Operational metrics (disk usage, error rates)

### Winston Configuration

```typescript
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple() // Human-readable in dev
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});
```

### Key Events to Log

| Event | Level | Fields |
|-------|-------|--------|
| Conversion started | `info` | `requestId`, `fileName`, `fileSize`, `fileType` |
| Conversion completed | `info` | `requestId`, `duration`, `outputSize` |
| Conversion failed | `error` | `requestId`, `error`, `fileName` |
| Validation failure | `warn` | `requestId`, `failureType`, `fileName` |
| File cleanup | `debug` | `fileId`, `age` |
| Server startup | `info` | `port`, `environment` |

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **console.log** | Unstructured; difficult to parse in production |
| **Pino** | Slightly faster but Winston's ecosystem is more mature |
| **Cloud logging (CloudWatch)** | External dependency; not required for MVP |

### Best Practices

1. **Request IDs**: Generate UUID per request for tracing
2. **No PII**: Don't log file contents or sensitive data
3. **Log levels**: Use appropriate levels (error/warn/info/debug)
4. **Rotation**: Use `winston-daily-rotate-file` to prevent disk fill

---

## 8. Environment Configuration

### Decision: dotenv for local dev + environment variables for production

### Rationale

Configuration must be:
- Environment-specific (dev/staging/prod)
- Secret-safe (no credentials in code)
- Easily changeable without redeployment

### Configuration Structure

```typescript
// infrastructure/config/index.ts
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  files: {
    maxSizeBytes: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10) * 1024 * 1024,
    retentionHours: parseInt(process.env.FILE_RETENTION_HOURS || '1', 10),
    allowedTypes: ['docx', 'xlsx', 'pptx']
  },

  conversion: {
    timeoutMs: parseInt(process.env.CONVERSION_TIMEOUT_MS || '30000', 10),
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_CONVERSIONS || '5', 10)
  },

  server: {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};
```

### .env.example

```env
# Server
PORT=3000
BASE_URL=http://localhost:3000
LOG_LEVEL=info

# File Handling
MAX_FILE_SIZE_MB=25
FILE_RETENTION_HOURS=1

# Conversion
CONVERSION_TIMEOUT_MS=30000
MAX_CONCURRENT_CONVERSIONS=5
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Config files (JSON/YAML)** | Harder to override per environment; secrets in version control |
| **Command-line args** | Cumbersome for many settings; doesn't work well with containers |
| **Hard-coded values** | Impossible to change without redeployment |

---

## 9. API Design

### Decision: RESTful API with OpenAPI 3.0 specification

### Rationale

REST provides:
- Widely understood conventions
- Easy integration for developers
- Standard HTTP status codes for error handling
- Simple to test and document

### Endpoint Design

**POST /api/v1/convert**
- Upload document for conversion
- Returns download URL immediately (blocking conversion for MVP)
- Future: Could return job ID for async processing

**GET /downloads/:fileId**
- Retrieve converted PDF
- fileId is UUID (not filename for security)
- Sets Content-Disposition header for download

### Response Format

```json
// Success response
{
  "success": true,
  "message": "File converted successfully",
  "downloadUrl": "https://api.example.com/downloads/a1b2c3d4-..."
}

// Error response
{
  "success": false,
  "error": {
    "message": "File size exceeds 25MB limit",
    "type": "ValidationError"
  }
}
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **GraphQL** | Overkill for 2 endpoints; adds complexity |
| **gRPC** | Requires protobuf; harder for web client integration |
| **Async with webhooks** | More complex for MVP; no user requirement |

---

## 10. Dependency Injection

### Decision: Manual constructor injection (no DI container)

### Rationale

For a small MVP, manual dependency injection provides:
- **Simplicity**: No framework to learn
- **Testability**: Easy to mock dependencies
- **Explicit dependencies**: Clear what each class needs
- **No magic**: Straightforward to debug

### Implementation Pattern

```typescript
// Composition root (server.ts or index.ts)
const storage = new TempFileStorageService();
const converter = new LibreOfficeConverterService();
const validator = new FileValidatorService();

const convertUseCase = new ConvertFileUseCase(
  storage,
  converter,
  validator
);

const downloadUseCase = new DownloadFileUseCase(storage);

const controller = new ConversionController(
  convertUseCase,
  downloadUseCase
);
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **TSyringe** | Adds dependency; relies on decorators/reflection |
| **InversifyJS** | Heavy framework; complex configuration |
| **NestJS built-in DI** | Not using NestJS for MVP |

### Future Consideration

If the application grows to 10+ services, consider introducing a lightweight DI container to reduce boilerplate.

---

## Summary

All technical decisions are documented with clear rationales. No areas remain marked as "NEEDS CLARIFICATION". The research prioritizes:

1. **Security**: Multi-layer validation, no shell injection, secure file handling
2. **Simplicity**: Manual DI, file system storage, synchronous processing
3. **Reliability**: Timeouts, error handling, automatic cleanup
4. **Maintainability**: Clean Architecture, TypeScript strict mode, comprehensive testing

These decisions align with the MVP requirements and can scale as usage grows.
