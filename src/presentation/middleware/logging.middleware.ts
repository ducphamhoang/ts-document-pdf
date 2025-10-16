import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../infrastructure/logger/winston.logger';

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const requestId = uuidv4();
  
  // Add request ID to response headers
  res.set('X-Request-ID', requestId);
  
  // Log the incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Capture the original end method
  const originalEnd = res.end;

  // Override the end method to log response details
  res.end = function(chunk?: any, encoding?: any, callback?: any): Response {
    const duration = Date.now() - startTime;
    
    // Log the response
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs: duration,
    });

    // Restore the original end method and call it
    res.end = originalEnd;
    return res.end(chunk, encoding, callback);
  };

  next();
};