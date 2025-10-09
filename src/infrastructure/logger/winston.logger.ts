import winston from 'winston';
import config from '../config';

// Create logs directory if it doesn't exist
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const logsDir = join(process.cwd(), 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'document-to-pdf-service' },
  transports: [
    // Write to all logs with level `info` and below to `combined.log`
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      level: 'info'
    }),
    
    // Write all logs error (and below) to `error.log`
    new winston.transports.File({ 
      filename: 'logs/error.log',
      level: 'error'
    })
  ]
});

// If we're not in production, log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;