import { Request, Response, NextFunction } from 'express';

/**
 * Enterprise-grade HTTP security headers middleware.
 * Equivalent to Helmet protections without third-party dependencies.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking via iframes (allow same origin)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Cross-site scripting filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict sensitive browser APIs
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Cross-Origin Opener Policy for OAuth popup safety
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  // Enforce HTTPS HSTS when in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Remove X-Powered-By
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * NoSQL injection & prototype pollution defense sanitizer.
 * Recursively inspects request query, body, and params to reject or strip
 * keys starting with '$' or containing '.' which could manipulate MongoDB queries.
 */
function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject).filter((item) => item !== undefined);
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Disallow MongoDB operators ($where, $gt, etc.) and prototype pollution
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
      continue;
    }

    if (value && typeof value === 'object') {
      const sanitizedChild = sanitizeObject(value);
      // If child object became empty after stripping operators, do not set empty object
      if (
        sanitizedChild &&
        typeof sanitizedChild === 'object' &&
        !Array.isArray(sanitizedChild) &&
        Object.keys(sanitizedChild).length === 0
      ) {
        continue;
      }
      cleaned[key] = sanitizedChild;
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export function sanitizeInputs(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}

/**
 * In-memory token bucket rate limiter for sensitive endpoints.
 */
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const buckets = new Map<string, RateLimitBucket>();
  const { windowMs, maxRequests, message = 'Too many requests. Please try again later.' } = options;

  // Cleanup old buckets periodically to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of buckets.entries()) {
      if (now - bucket.lastRefill > windowMs * 2) {
        buckets.delete(ip);
      }
    }
  }, Math.max(60000, windowMs * 2)).unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = (req.ip || req.socket.remoteAddress || 'unknown').toString();
    const now = Date.now();

    let bucket = buckets.get(clientIp);
    if (!bucket) {
      bucket = { tokens: maxRequests - 1, lastRefill: now };
      buckets.set(clientIp, bucket);
      return next();
    }

    // Refill tokens based on time passed
    const elapsed = now - bucket.lastRefill;
    if (elapsed > windowMs) {
      bucket.tokens = maxRequests - 1;
      bucket.lastRefill = now;
      return next();
    }

    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return next();
    }

    // Rate limit exceeded
    const retryAfterSeconds = Math.ceil((windowMs - elapsed) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      retryAfterSeconds,
    });
  };
}
