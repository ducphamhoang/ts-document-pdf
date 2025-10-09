export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class UnsupportedFileTypeError extends DomainError {
  constructor(message: string = 'File type is not supported') {
    super(message);
  }
}

export class FileTooLargeError extends DomainError {
  constructor(message: string = 'File size exceeds the maximum allowed limit') {
    super(message);
  }
}

export class InvalidFileSignatureError extends DomainError {
  constructor(message: string = 'File signature is invalid or corrupted') {
    super(message);
  }
}

export class ConversionFailedError extends DomainError {
  constructor(message: string = 'Document conversion failed') {
    super(message);
  }
}

export class ConversionTimeoutError extends DomainError {
  constructor(message: string = 'Document conversion timed out') {
    super(message);
  }
}

export class FileNotFoundError extends DomainError {
  constructor(message: string = 'File not found') {
    super(message);
  }
}