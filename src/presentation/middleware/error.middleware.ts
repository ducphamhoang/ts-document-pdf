import { Request, Response, NextFunction } from 'express';
import {
  DomainError,
  ValidationError,
  UnsupportedFileTypeError,
  FileTooLargeError,
  ConversionFailedError,
  ConversionTimeoutError,
  FileNotFoundError,
} from '../../domain/errors';
import logger from '../../infrastructure/logger/winston.logger';

interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  path: string;
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
  let errorType = 'InternalServerError';

  // Map domain errors to appropriate HTTP status codes and provide helpful messages
  if (error instanceof ValidationError) {
    status = 400;
    message = error.message;
    errorType = 'ValidationError';
  } else if (error instanceof UnsupportedFileTypeError) {
    status = 415;
    message = error.message;
    errorType = 'UnsupportedFileTypeError';
  } else if (error instanceof FileTooLargeError) {
    status = 413;
    message = error.message;
    errorType = 'FileTooLargeError';
  } else if (error instanceof ConversionFailedError) {
    status = 422;
    message = error.message;
    errorType = 'ConversionFailedError';
  } else if (error instanceof ConversionTimeoutError) {
    status = 504;
    message = error.message;
    errorType = 'ConversionTimeoutError';
  } else if (error instanceof FileNotFoundError) {
    status = 404;
    message = error.message;
    errorType = 'FileNotFoundError';
  } else if (error instanceof DomainError) {
    status = 422;
    message = error.message;
    errorType = error.constructor.name;
  } else {
    // For non-domain errors, provide a generic message to avoid exposing internal details
    status = 500;
    message = 'An internal server error occurred. Please try again later.';
    errorType = 'InternalServerError';
    
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
    error: errorType,
    message,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  // Log error details
  logger.error('API Error Response', {
    errorType,
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