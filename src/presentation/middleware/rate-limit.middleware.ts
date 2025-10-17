import rateLimit from 'express-rate-limit';
import logger from '../../infrastructure/logger/winston.logger';

/**
 * Rate limiting middleware for translation API
 * Prevents abuse and ensures fair usage
 */

// Get rate limit from environment or use default (60 requests per minute = 1 per second average)
const requestsPerMinute = parseInt(process.env.GEMINI_RATE_LIMIT_RPM || '60', 10);

export const translationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: requestsPerMinute, // Limit each IP to X requests per window
  message: {
    success: false,
    message: 'Too many translation requests from this IP, please try again later.',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      details: {
        retryAfter: '1 minute',
        limit: requestsPerMinute,
      },
    },
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent'),
    });

    res.status(429).json({
      success: false,
      message: 'Too many translation requests from this IP, please try again later.',
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          retryAfter: '1 minute',
          limit: requestsPerMinute,
        },
      },
    });
  },
  skip: req => {
    // Skip rate limiting for health check endpoints
    return req.path === '/health' || req.path === '/api/v1/health';
  },
});

/**
 * General API rate limiter (more permissive)
 * Applied to all API routes
 */
export const generalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('General rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });

    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          retryAfter: '15 minutes',
        },
      },
    });
  },
});
