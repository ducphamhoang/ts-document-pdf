import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../domain/errors';

export const fileValidationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Check if a file was uploaded in the 'file' field
  if (!req.file) {
    const error = new ValidationError('No file uploaded. Please include a file in the \'file\' field.');
    (error as any).status = 400;
    next(error);
    return;
  }
  
  next();
};