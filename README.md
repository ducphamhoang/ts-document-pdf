# Document to PDF Conversion Service

A service that converts office documents (DOCX, XLSX, PPTX) to PDF format with an easy-to-use API.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Error Handling](#error-handling)
- [File Cleanup](#file-cleanup)
- [Environment Variables](#environment-variables)

## Features

- Convert DOCX, XLSX, PPTX files to PDF
- File validation (type, size, signature)
- Unique download URLs for converted files
- Automatic file cleanup after retention period
- Comprehensive logging
- Error handling with appropriate HTTP status codes
- File size limits and timeout controls

## Prerequisites

- Node.js (v16 or higher)
- LibreOffice (for document conversion)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ts-document-pdf
```

2. Install dependencies:
```bash
npm install
```

3. Install LibreOffice (required for document conversion):
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y libreoffice

# CentOS/RHEL
sudo yum install libreoffice

# macOS
brew install --cask libreoffice
```

4. Create a `.env` file based on `.env.example`:
```bash
cp config/.env.example config/.env
```

5. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run build
npm start
```

The server will start on `http://localhost:3000` by default.

## Configuration

- Default port: `3000`
- Maximum file size: `25MB`
- File retention: `24 hours`
- Conversion timeout: `30 seconds`
- Maximum concurrent conversions: `5`

These values can be adjusted in the configuration file or environment variables.

## Usage

### Converting an Office Document to PDF

To convert a document to PDF, make a POST request to the `/api/v1/convert` endpoint with a file attachment:

```bash
curl -X POST http://localhost:3000/api/v1/convert \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/your/document.docx"
```

#### Example Response:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "downloadUrl": "http://localhost:3000/downloads/a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "filename": "converted_a1b2c3d4-e5f6-7890-1234-567890abcdef.pdf",
    "sizeBytes": 53472,
    "expiresAt": "2023-10-11T10:30:00.000Z"
  }
}
```

### Downloading the Converted PDF

Use the `downloadUrl` from the conversion response to download the PDF file:

```bash
curl -X GET http://localhost:3000/downloads/a1b2c3d4-e5f6-7890-1234-567890abcdef -o converted_document.pdf
```

## API Endpoints

### POST `/api/v1/convert`

Upload an office document file to convert to PDF.

- **Content-Type**: `multipart/form-data`
- **File field**: `file`
- **Supported formats**: DOCX, XLSX, PPTX
- **Max file size**: 25MB (configurable)

**Response**:
- `200 OK` - Conversion successful
- `400 Bad Request` - Missing file or invalid request
- `413 Payload Too Large` - File exceeds size limit
- `415 Unsupported Media Type` - Invalid file type
- `422 Unprocessable Entity` - File is invalid or conversion failed
- `504 Gateway Timeout` - Conversion timed out

### GET `/downloads/:fileId`

Download the converted PDF file.

- **FileId**: ID returned from the conversion request
- **Response**: PDF file with appropriate headers

**Response**:
- `200 OK` - File downloaded successfully
- `404 Not Found` - File not found or expired

## Error Handling

The service provides detailed error responses with appropriate HTTP status codes:

- `400`: Missing file, invalid request format
- `413`: File size exceeds configured limit
- `415`: Unsupported file type
- `422`: Invalid file content, conversion failed
- `404`: Download file not found or expired
- `504`: Conversion timeout
- `500`: Internal server error

Example error response:
```json
{
  "error": "FileTooLargeError",
  "message": "File size 30000000 bytes exceeds the maximum allowed size of 25MB",
  "timestamp": "2023-10-10T10:00:00.000Z",
  "path": "/api/v1/convert"
}
```

## File Cleanup

Converted PDF files are automatically cleaned up after the retention period (default: 24 hours). The service runs cleanup every 15 minutes to remove expired files.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| BASE_URL | http://localhost:3000 | Base URL for download links |
| MAX_FILE_SIZE_MB | 25 | Maximum file size in megabytes |
| FILE_RETENTION_HOURS | 24 | Hours to retain converted files |
| CONVERSION_TIMEOUT_MS | 30000 | Conversion timeout in milliseconds |
| MAX_CONCURRENT_CONVERSIONS | 5 | Max concurrent LibreOffice processes |
| LOG_LEVEL | info | Logging level (error, warn, info, debug) |

## Project Structure

```
src/
├── domain/                 # Domain entities and errors
├── application/            # Application logic and use cases
├── infrastructure/         # External services and config
│   ├── config/             # Configuration files
│   ├── logger/             # Logging services
│   └── services/           # Infrastructure services
└── presentation/           # Controllers, routes and middleware
    ├── controllers/        # API controllers
    ├── middleware/         # Express middleware
    ├── routes/             # API route definitions
    └── dto/                # Data transfer objects
```

## Development

- **Development server**: `npm run dev`
- **Build**: `npm run build`
- **Start production**: `npm start`
- **Run tests**: `npm test`

## License

MIT