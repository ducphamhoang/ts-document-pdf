# Quickstart Guide: Document to PDF Conversion Service

**Feature**: Document to PDF Conversion Service
**Branch**: `001-make-mvp-please`
**Date**: 2025-10-10

## Overview

This guide helps developers quickly understand and start using the Document to PDF Conversion Service. It covers the core API endpoints, authentication (none for MVP), request/response formats, and common integration patterns.

---

## Prerequisites

- Node.js 20.x or later (LTS)
- LibreOffice installed and accessible via command line (`libreoffice --version`)
- npm or yarn package manager

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ts-document-pdf
git checkout 001-make-mvp-please
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file and adjust settings:

```bash
cp config/.env.example .env
```

**Key Configuration Options**:

```env
# Server Configuration
PORT=3000
BASE_URL=http://localhost:3000
LOG_LEVEL=info

# File Handling
MAX_FILE_SIZE_MB=25
FILE_RETENTION_HOURS=1

# Conversion Settings
CONVERSION_TIMEOUT_MS=30000
MAX_CONCURRENT_CONVERSIONS=5
```

### 4. Verify LibreOffice Installation

```bash
libreoffice --version
# Should output: LibreOffice 7.x.x.x or later
```

If LibreOffice is not installed:

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install libreoffice
```

**macOS** (via Homebrew):
```bash
brew install --cask libreoffice
```

### 5. Run the Server

**Development Mode** (with hot reload):
```bash
npm run dev
```

**Production Mode**:
```bash
npm run build
npm start
```

The API will be available at `http://localhost:3000`.

---

## API Usage

### Endpoint Overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/convert` | Upload and convert document to PDF |
| GET | `/downloads/:fileId` | Download converted PDF file |

### Authentication

**MVP has no authentication**. All endpoints are publicly accessible. Future versions may add API key authentication.

---

## Converting a Document

### Request

**Endpoint**: `POST /api/v1/convert`

**Content-Type**: `multipart/form-data`

**Parameters**:
- `file` (required): The office document file (DOCX, XLSX, or PPTX)

### Example: cURL

```bash
curl -X POST http://localhost:3000/api/v1/convert \
  -F "file=@/path/to/document.docx"
```

### Example: JavaScript (Fetch API)

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:3000/api/v1/convert', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result.downloadUrl);
```

### Example: Python (requests)

```python
import requests

url = 'http://localhost:3000/api/v1/convert'
files = {'file': open('document.docx', 'rb')}

response = requests.post(url, files=files)
data = response.json()

if data['success']:
    print(f"Download URL: {data['downloadUrl']}")
else:
    print(f"Error: {data['error']['message']}")
```

### Example: Node.js (axios)

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('document.docx'));

const response = await axios.post('http://localhost:3000/api/v1/convert', form, {
  headers: form.getHeaders()
});

console.log('Download URL:', response.data.downloadUrl);
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "File converted successfully",
  "downloadUrl": "http://localhost:3000/downloads/a1b2c3d4-e5f6-7890-1234-567890abcdef"
}
```

### Error Responses

**400 Bad Request** (Missing file):
```json
{
  "success": false,
  "error": {
    "message": "File is required in 'file' field",
    "type": "ValidationError"
  }
}
```

**413 Payload Too Large** (File > 25MB):
```json
{
  "success": false,
  "error": {
    "message": "File size exceeds 25MB limit",
    "type": "FileTooLargeError"
  }
}
```

**415 Unsupported Media Type** (Invalid format):
```json
{
  "success": false,
  "error": {
    "message": "Unsupported file type. Supported formats: DOCX, XLSX, PPTX",
    "type": "UnsupportedFileTypeError"
  }
}
```

**422 Unprocessable Entity** (Corrupted file):
```json
{
  "success": false,
  "error": {
    "message": "Document conversion failed. The file may be corrupted or malformed",
    "type": "ConversionFailedError"
  }
}
```

**504 Gateway Timeout** (Conversion timeout):
```json
{
  "success": false,
  "error": {
    "message": "Document conversion timed out. The file may be too complex",
    "type": "ConversionTimeoutError"
  }
}
```

---

## Downloading a Converted PDF

### Request

**Endpoint**: `GET /downloads/:fileId`

**Parameters**:
- `fileId` (path parameter): The UUID from the conversion response's `downloadUrl`

### Example: cURL

```bash
curl -O -J http://localhost:3000/downloads/a1b2c3d4-e5f6-7890-1234-567890abcdef
```

### Example: Browser

Simply open the `downloadUrl` in a browser:
```
http://localhost:3000/downloads/a1b2c3d4-e5f6-7890-1234-567890abcdef
```

The browser will download the PDF with the original filename.

### Example: JavaScript (Download in Browser)

```javascript
const downloadUrl = response.data.downloadUrl;
const link = document.createElement('a');
link.href = downloadUrl;
link.download = 'converted-document.pdf';
link.click();
```

### Example: Python (Save to File)

```python
import requests

download_url = data['downloadUrl']
response = requests.get(download_url)

with open('converted-document.pdf', 'wb') as f:
    f.write(response.content)
```

### Success Response (200 OK)

**Headers**:
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="document.pdf"`
- `Content-Length: 123456`

**Body**: Binary PDF file data

### Error Response (404 Not Found)

```json
{
  "success": false,
  "error": {
    "message": "File not found or has expired",
    "type": "FileNotFoundError"
  }
}
```

**Common Causes**:
- File has expired (default: 1 hour after conversion)
- Invalid `fileId` (typo or wrong UUID)
- File was manually deleted

---

## Integration Patterns

### Pattern 1: Synchronous Conversion (MVP)

**Use Case**: User uploads document, waits for conversion, downloads immediately.

```javascript
async function convertAndDownload(file) {
  // Step 1: Upload and convert
  const formData = new FormData();
  formData.append('file', file);

  const convertResponse = await fetch('/api/v1/convert', {
    method: 'POST',
    body: formData
  });

  const result = await convertResponse.json();

  if (!result.success) {
    throw new Error(result.error.message);
  }

  // Step 2: Download PDF
  const downloadResponse = await fetch(result.downloadUrl);
  const pdfBlob = await downloadResponse.blob();

  // Step 3: Trigger browser download
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'converted.pdf';
  a.click();
}
```

### Pattern 2: Batch Conversion

**Use Case**: Convert multiple documents sequentially.

```javascript
async function convertBatch(files) {
  const results = [];

  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/v1/convert', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      results.push({ file: file.name, ...result });
    } catch (error) {
      results.push({ file: file.name, success: false, error: error.message });
    }
  }

  return results;
}
```

### Pattern 3: Error Handling with Retry

**Use Case**: Retry conversion on transient failures (timeout, server error).

```javascript
async function convertWithRetry(file, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/v1/convert', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        return result;
      }

      // Don't retry client errors (400, 415, 422)
      if (result.error.type !== 'ConversionTimeoutError' &&
          result.error.type !== 'InternalServerError') {
        throw new Error(result.error.message);
      }

      lastError = result.error;
    } catch (error) {
      lastError = error;
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  throw new Error(`Conversion failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

---

## Testing the API

### Health Check

Verify the server is running:

```bash
curl http://localhost:3000/
```

Expected response:
```json
{
  "status": "ok",
  "service": "Document to PDF Conversion API",
  "version": "1.0.0"
}
```

### Test with Sample Documents

Use the provided test fixtures:

```bash
# Convert DOCX
curl -X POST http://localhost:3000/api/v1/convert \
  -F "file=@tests/fixtures/sample.docx"

# Convert XLSX
curl -X POST http://localhost:3000/api/v1/convert \
  -F "file=@tests/fixtures/sample.xlsx"

# Convert PPTX
curl -X POST http://localhost:3000/api/v1/convert \
  -F "file=@tests/fixtures/sample.pptx"
```

### Test Error Scenarios

**Unsupported file type**:
```bash
curl -X POST http://localhost:3000/api/v1/convert \
  -F "file=@tests/fixtures/invalid.txt"
# Expected: 415 Unsupported Media Type
```

**File too large** (create 26MB file):
```bash
dd if=/dev/zero of=large.docx bs=1M count=26
curl -X POST http://localhost:3000/api/v1/convert \
  -F "file=@large.docx"
# Expected: 413 Payload Too Large
```

**Missing file**:
```bash
curl -X POST http://localhost:3000/api/v1/convert
# Expected: 400 Bad Request
```

---

## Running Tests

### Unit Tests

```bash
npm run test:unit
```

### Integration Tests

```bash
npm run test:integration
```

### All Tests with Coverage

```bash
npm test
```

---

## Troubleshooting

### Issue: "LibreOffice not found"

**Solution**: Ensure LibreOffice is installed and accessible:
```bash
which libreoffice
# Should output: /usr/bin/libreoffice or similar
```

Add to PATH if needed:
```bash
export PATH=$PATH:/Applications/LibreOffice.app/Contents/MacOS  # macOS
```

### Issue: "Conversion timeout"

**Possible Causes**:
- Complex document with many images/charts
- Insufficient server resources
- LibreOffice process hanging

**Solutions**:
1. Increase timeout in `.env`:
   ```env
   CONVERSION_TIMEOUT_MS=60000  # 60 seconds
   ```

2. Check LibreOffice process:
   ```bash
   ps aux | grep soffice
   ```

3. Restart the server to clear stale processes

### Issue: "Disk full" errors

**Cause**: Temporary files not cleaned up

**Solutions**:
1. Manually clean temp directory:
   ```bash
   rm -rf /tmp/convert-*
   ```

2. Verify cleanup cron job is running:
   ```bash
   # Check cleanup service status
   systemctl status pdf-converter-cleanup
   ```

3. Reduce retention time in `.env`:
   ```env
   FILE_RETENTION_HOURS=0.5  # 30 minutes
   ```

### Issue: "MIME type validation fails for valid files"

**Cause**: File uploaded without correct Content-Type

**Solution**: Ensure your HTTP client sets the correct Content-Type header:
```javascript
// Incorrect (manual header)
headers: { 'Content-Type': 'multipart/form-data' }

// Correct (let browser/library set it)
// FormData automatically sets multipart/form-data with boundary
```

---

## Performance Considerations

### Expected Performance

| Metric | Target | Notes |
|--------|--------|-------|
| API response time | < 500ms | Excluding conversion time |
| Conversion time (5MB DOCX) | < 10 seconds | 95th percentile |
| Concurrent conversions | 100+ | With proper queue management |
| File retention | 1 hour | Configurable via env var |

### Optimization Tips

1. **Increase concurrent conversion limit** (if server has resources):
   ```env
   MAX_CONCURRENT_CONVERSIONS=10
   ```

2. **Use a queue system** for high load (future enhancement):
   - Redis + Bull queue
   - Returns job ID immediately, polls for completion

3. **Enable caching** for repeated conversions (future enhancement):
   - Hash file content → check if already converted
   - Serve cached PDF if available

---

## API Contract

Full OpenAPI 3.0 specification available at:
- **Local**: `specs/001-make-mvp-please/contracts/api.openapi.yaml`
- **Interactive Docs** (if enabled): `http://localhost:3000/api-docs`

---

## Next Steps

1. **Explore the codebase**: See `specs/001-make-mvp-please/plan.md` for architecture overview
2. **Review data model**: See `specs/001-make-mvp-please/data-model.md` for entity details
3. **Read research notes**: See `specs/001-make-mvp-please/research.md` for technical decisions
4. **Start implementing**: See `specs/001-make-mvp-please/tasks.md` (generated by `/speckit.tasks`)

---

## Support

For issues or questions:
- Review the [troubleshooting section](#troubleshooting)
- Check server logs: `tail -f logs/combined.log`
- Open an issue in the repository

**Happy converting!**
