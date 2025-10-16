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

// Translation-specific errors
export class TranslationError extends DomainError {
  constructor(message: string = 'Translation failed') {
    super(message);
  }
}

export class InvalidLanguageError extends TranslationError {
  constructor(message: string = 'Invalid language code provided') {
    super(message);
  }
}

export class TokenLimitExceededError extends TranslationError {
  public readonly actualTokens?: number;
  public readonly maxTokens?: number;

  constructor(
    message: string = 'Text content exceeds the 10,000 token limit',
    actualTokens?: number,
    maxTokens?: number
  ) {
    super(message);
    this.actualTokens = actualTokens;
    this.maxTokens = maxTokens;
  }
}

export class TranslationServiceUnavailableError extends TranslationError {
  constructor(message: string = 'Translation service is temporarily unavailable') {
    super(message);
  }
}

export class TranslationTimeoutError extends TranslationError {
  constructor(message: string = 'Translation request timed out') {
    super(message);
  }
}