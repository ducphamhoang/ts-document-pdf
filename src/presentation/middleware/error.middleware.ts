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

  // Map domain errors to appropriate HTTP status codes
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
    // Log unexpected errors
    console.error(`Unexpected error: ${error.message}`, error);
  }

  const errorResponse: ErrorResponse = {
    error: errorType,
    message,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(status).json(errorResponse);
};