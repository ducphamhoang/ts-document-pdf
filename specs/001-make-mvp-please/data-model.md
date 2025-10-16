# Data Model: Document to PDF Conversion Service

**Feature**: Document to PDF Conversion Service
**Branch**: `001-make-mvp-please`
**Date**: 2025-10-10

## Overview

This document defines the core entities and their relationships for the Document to PDF Conversion Service. Since this is an MVP with no database, entities represent in-memory/file-system domain objects that encapsulate business logic and state.

---

## Entity Diagram

```
┌─────────────────────┐
│  UploadedDocument   │
└──────────┬──────────┘
           │ 1
           │
           │ converts to
           │
           │ 1
┌──────────▼──────────┐      ┌──────────────────┐
│   ConversionJob     │──────│  ConvertedPDF    │
└─────────────────────┘  1:1 └──────────────────┘
     (tracks process)         (result)
```

**Relationships**:
- One `UploadedDocument` triggers one `ConversionJob`
- One `ConversionJob` produces one `ConvertedPDF` (on success)
- `ConversionJob` tracks the lifecycle from upload to completion/failure

---

## Entities

### 1. UploadedDocument

**Purpose**: Represents an office document submitted for conversion.

**Attributes**:

| Attribute | Type | Description | Validation Rules |
|-----------|------|-------------|------------------|
| `id` | `string` (UUID) | Unique identifier | Auto-generated via `crypto.randomUUID()` |
| `originalFilename` | `string` | User-provided filename | Max 255 chars, sanitized (no path traversal) |
| `mimeType` | `string` | Content type | Must be one of: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| `sizeBytes` | `number` | File size in bytes | Must be > 0 and ≤ 26,214,400 (25MB) |
| `tempPath` | `string` | Absolute path to uploaded file | Must be within allowed temp directory |
| `uploadedAt` | `Date` | Upload timestamp | Auto-set on creation |
| `fileExtension` | `string` | Normalized extension | Derived from MIME type: `docx`, `xlsx`, or `pptx` |

**Business Rules**:
- `originalFilename` must be sanitized to prevent path traversal attacks (remove `..`, `/`, `\`)
- `sizeBytes` must not exceed configured `MAX_FILE_SIZE_MB`
- `tempPath` must be validated to exist in file system before use
- `mimeType` must match file signature (magic bytes check)

**State Transitions**: None (immutable after creation)

**TypeScript Representation**:
```typescript
interface UploadedDocument {
  readonly id: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly tempPath: string;
  readonly uploadedAt: Date;
  readonly fileExtension: 'docx' | 'xlsx' | 'pptx';
}
```

---

### 2. ConvertedPDF

**Purpose**: Represents the PDF file produced after successful conversion.

**Attributes**:

| Attribute | Type | Description | Validation Rules |
|-----------|------|-------------|------------------|
| `id` | `string` (UUID) | Unique identifier (same as job ID) | Auto-generated via `crypto.randomUUID()` |
| `originalDocumentId` | `string` (UUID) | Reference to source document | Must reference valid `UploadedDocument.id` |
| `filename` | `string` | PDF filename | Derived from original: `{originalFilename}.pdf` |
| `sizeBytes` | `number` | PDF file size in bytes | Must be > 0 |
| `tempPath` | `string` | Absolute path to PDF file | Must be within allowed temp directory |
| `downloadUrl` | `string` | Public download URL | Format: `{BASE_URL}/downloads/{id}` |
| `createdAt` | `Date` | Conversion completion time | Auto-set on creation |
| `expiresAt` | `Date` | Expiration time | `createdAt + FILE_RETENTION_HOURS` |
| `downloadCount` | `number` | Number of times downloaded | Starts at 0, incremented on each download |

**Business Rules**:
- `expiresAt` is calculated based on `FILE_RETENTION_HOURS` config (default: 1 hour)
- `downloadUrl` uses secure UUID, not original filename, to prevent enumeration
- `filename` preserves original document name for user convenience in download
- PDF must be deleted from file system when `expiresAt` is reached

**State Transitions**: None (immutable except `downloadCount`)

**TypeScript Representation**:
```typescript
interface ConvertedPDF {
  readonly id: string;
  readonly originalDocumentId: string;
  readonly filename: string;
  readonly sizeBytes: number;
  readonly tempPath: string;
  readonly downloadUrl: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  downloadCount: number; // mutable
}
```

---

### 3. ConversionJob

**Purpose**: Tracks the lifecycle of a conversion request from upload to completion.

**Attributes**:

| Attribute | Type | Description | Validation Rules |
|-----------|------|-------------|------------------|
| `id` | `string` (UUID) | Unique job identifier | Auto-generated via `crypto.randomUUID()` |
| `uploadedDocument` | `UploadedDocument` | Source document | Required |
| `status` | `ConversionStatus` (enum) | Current job state | One of: `queued`, `processing`, `completed`, `failed` |
| `startedAt` | `Date \| null` | When processing began | Set when status → `processing` |
| `completedAt` | `Date \| null` | When job finished | Set when status → `completed` or `failed` |
| `convertedPDF` | `ConvertedPDF \| null` | Result (if successful) | Only set when status = `completed` |
| `error` | `Error \| null` | Error details (if failed) | Only set when status = `failed` |
| `durationMs` | `number \| null` | Processing time in ms | `completedAt - startedAt` |

**Enum: ConversionStatus**:
```typescript
enum ConversionStatus {
  Queued = 'queued',       // Job created, waiting to start
  Processing = 'processing', // LibreOffice conversion in progress
  Completed = 'completed',   // PDF generated successfully
  Failed = 'failed'          // Conversion failed (error set)
}
```

**Business Rules**:
- Initial status is always `queued`
- `startedAt` must be set when status transitions to `processing`
- `completedAt` must be set when status transitions to `completed` or `failed`
- If status is `completed`, `convertedPDF` must be non-null
- If status is `failed`, `error` must be non-null
- `durationMs` is only calculated for `completed` or `failed` jobs

**State Transitions**:
```
queued → processing → completed
                   ↘ failed
```

**TypeScript Representation**:
```typescript
enum ConversionStatus {
  Queued = 'queued',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed'
}

interface ConversionJob {
  readonly id: string;
  readonly uploadedDocument: UploadedDocument;
  status: ConversionStatus; // mutable
  startedAt: Date | null;   // mutable
  completedAt: Date | null; // mutable
  convertedPDF: ConvertedPDF | null; // mutable
  error: Error | null;      // mutable
  durationMs: number | null; // computed
}
```

---

## Domain Errors

Custom error classes represent domain-specific failure scenarios.

| Error Class | HTTP Status | Trigger Condition |
|-------------|-------------|-------------------|
| `ValidationError` | 400 | Missing file in request |
| `UnsupportedFileTypeError` | 415 | File type not DOCX/XLSX/PPTX |
| `FileTooLargeError` | 413 | File exceeds 25MB limit |
| `InvalidFileSignatureError` | 422 | File signature doesn't match MIME type |
| `ConversionFailedError` | 422 | LibreOffice conversion failed (malformed file) |
| `ConversionTimeoutError` | 504 | LibreOffice process exceeded timeout |
| `FileNotFoundError` | 404 | Download URL references non-existent file |

**TypeScript Representation**:
```typescript
class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends DomainError {}
class UnsupportedFileTypeError extends DomainError {}
class FileTooLargeError extends DomainError {}
class InvalidFileSignatureError extends DomainError {}
class ConversionFailedError extends DomainError {}
class ConversionTimeoutError extends DomainError {}
class FileNotFoundError extends DomainError {}
```

---

## Data Flow

### Upload and Conversion Flow

```
1. User uploads file
   ↓
2. Create UploadedDocument entity
   - Validate MIME type, size, signature
   ↓
3. Create ConversionJob (status: queued)
   ↓
4. Update status → processing
   - Set startedAt
   ↓
5. Invoke LibreOffice CLI
   ↓
6a. Success: Create ConvertedPDF entity
    - Update job status → completed
    - Set completedAt, durationMs
    - Return download URL
   ↓
6b. Failure: Set job error
    - Update job status → failed
    - Set completedAt, error
    - Return error response
```

### Download Flow

```
1. User requests GET /downloads/:fileId
   ↓
2. Lookup ConvertedPDF by ID
   ↓
3. Check if PDF expired (now > expiresAt)
   ↓
4a. Expired: Return 404 FileNotFoundError
   ↓
4b. Valid: Serve PDF file
    - Increment downloadCount
    - Set Content-Disposition header
    - Stream file to client
```

### Cleanup Flow

```
1. Scheduled job runs every 15 minutes
   ↓
2. Find ConvertedPDF where expiresAt < now
   ↓
3. For each expired PDF:
   - Delete file from file system (tempPath)
   - Remove from in-memory store
   - Log cleanup event
```

---

## Storage Strategy

**MVP Approach**: In-memory Map for metadata + file system for files

### In-Memory Store

```typescript
// Global store (in production, use Redis or similar)
const conversionJobs = new Map<string, ConversionJob>();
const convertedPDFs = new Map<string, ConvertedPDF>();
```

**Trade-offs**:
- ✅ Simple implementation for MVP
- ✅ Fast lookups (O(1))
- ❌ Lost on server restart (acceptable for MVP)
- ❌ Not horizontally scalable (single server only)

**Future Enhancement**: Replace with Redis or database for persistence and scalability.

### File System Storage

**Directory Structure**:
```
/tmp/
├── convert-a1b2c3d4/          # Unique per conversion
│   ├── document.docx          # Uploaded document
│   └── document.pdf           # Converted PDF
├── convert-e5f6g7h8/
│   ├── spreadsheet.xlsx
│   └── spreadsheet.pdf
└── ...
```

**Cleanup Strategy**:
- Each conversion gets unique directory via `fs.mkdtemp`
- Directory is deleted after file expires or download completes (configurable)
- Startup script removes stale directories from previous server runs

---

## Validation Rules Summary

### UploadedDocument Validation
- ✅ `originalFilename`: Non-empty, sanitized (no `..`, `/`, `\`)
- ✅ `mimeType`: One of allowed MIME types
- ✅ `sizeBytes`: > 0 and ≤ 25MB
- ✅ `fileExtension`: Derived from MIME type
- ✅ File signature: Magic bytes match MIME type

### ConvertedPDF Validation
- ✅ `sizeBytes`: > 0 (PDF must not be empty)
- ✅ `tempPath`: File exists on disk
- ✅ `expiresAt`: In the future (> now)

### ConversionJob State Machine
- ✅ Status transitions follow allowed paths (queued → processing → completed/failed)
- ✅ `startedAt` set when entering `processing`
- ✅ `completedAt` set when entering `completed` or `failed`
- ✅ `convertedPDF` set only for `completed` jobs
- ✅ `error` set only for `failed` jobs

---

## Summary

The data model consists of three core entities:

1. **UploadedDocument**: Immutable representation of user-submitted office document
2. **ConvertedPDF**: Immutable representation of conversion result with download URL
3. **ConversionJob**: Mutable state machine tracking conversion lifecycle

All entities enforce business rules through validation. Domain errors provide clear failure semantics without coupling to HTTP. The MVP uses in-memory storage for simplicity, with a clear path to database/cache persistence for production scaling.
