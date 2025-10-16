import { Request, Response, NextFunction } from 'express';
import {
  DomainError,
  ValidationError,
  UnsupportedFileTypeError,
  FileTooLargeError,
  ConversionFailedError,
  ConversionTimeoutError,
  FileNotFoundError,
  TranslationError,
  InvalidLanguageError,
  TokenLimitExceededError,
  TranslationServiceUnavailableError,
  TranslationTimeoutError,
} from '../../domain/errors';
import logger from '../../infrastructure/logger/winston.logger';

interface ErrorResponse {
  success: boolean;
  message: string;
  error?: {
    code: string;
    details?: any;
  };
}

export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  let status = 500;
  let message = 'Internal Server Error';
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let errorDetails: any = undefined;

  // Map domain errors to appropriate HTTP status codes and provide helpful messages
  // Translation errors
  if (error instanceof InvalidLanguageError) {
    status = 400;
    message = error.message;
    errorCode = 'INVALID_LANGUAGE';
  } else if (error instanceof TokenLimitExceededError) {
    status = 413;
    message = error.message;
    errorCode = 'TOKEN_LIMIT_EXCEEDED';
    errorDetails = {
      actualTokens: error.actualTokens,
      maxTokens: error.maxTokens,
    };
  } else if (error instanceof TranslationServiceUnavailableError) {
    status = 503;
    message = error.message;
    errorCode = 'TRANSLATION_SERVICE_UNAVAILABLE';
  } else if (error instanceof TranslationTimeoutError) {
    status = 504;
    message = error.message;
    errorCode = 'TIMEOUT';
  } else if (error instanceof TranslationError) {
    status = 422;
    message = error.message;
    errorCode = 'TRANSLATION_FAILED';
  }
  // File/conversion errors
  else if (error instanceof ValidationError) {
    status = 400;
    message = error.message;
    errorCode = 'VALIDATION_ERROR';
  } else if (error instanceof UnsupportedFileTypeError) {
    status = 415;
    message = error.message;
    errorCode = 'UNSUPPORTED_FILE_TYPE';
  } else if (error instanceof FileTooLargeError) {
    status = 413;
    message = error.message;
    errorCode = 'FILE_TOO_LARGE';
  } else if (error instanceof ConversionFailedError) {
    status = 422;
    message = error.message;
    errorCode = 'CONVERSION_FAILED';
  } else if (error instanceof ConversionTimeoutError) {
    status = 504;
    message = error.message;
    errorCode = 'CONVERSION_TIMEOUT';
  } else if (error instanceof FileNotFoundError) {
    status = 404;
    message = error.message;
    errorCode = 'FILE_NOT_FOUND';
  } else if (error instanceof DomainError) {
    status = 422;
    message = error.message;
    errorCode = error.constructor.name.replace(/Error$/, '').toUpperCase();
  } else {
    // For non-domain errors, provide a generic message to avoid exposing internal details
    status = 500;
    message = 'An internal server error occurred. Please try again later.';
    errorCode = 'INTERNAL_SERVER_ERROR';

    // Log the full error details for debugging (only in server logs, not in response)
    logger.error('Unhandled error occurred', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      url: req.url,
    });
  }

  // Create error response with consistent format
  const errorResponse: ErrorResponse = {
    success: false,
    message,
    error: {
      code: errorCode,
      ...(errorDetails && { details: errorDetails }),
    },
  };

  // Log error details
  logger.error('API Error Response', {
    errorCode,
    message,
    status,
    path: req.path,
    method: req.method,
    originalUrl: req.originalUrl,
    userAgent: req.get('User-Agent'),
    requestId: res.get('X-Request-ID'),
  });

  // Send error response
  res.status(status).json(errorResponse);
};