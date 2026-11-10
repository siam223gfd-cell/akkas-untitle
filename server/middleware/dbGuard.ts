import { Request, Response, NextFunction } from 'express';
import { isDatabaseConnected, dbStatus } from '../database/connection';

/**
 * Middleware that guarantees MongoDB Atlas is connected before executing
 * state-mutating or database-dependent operations.
 * Fails fast with 503 Service Unavailable if unconfigured.
 */
export function requireDatabase(req: Request, res: Response, next: NextFunction) {
  if (!isDatabaseConnected()) {
    return res.status(503).json({
      success: false,
      code: 'DATABASE_UNCONFIGURED',
      message: 'MongoDB Atlas is unconfigured or disconnected. An active MongoDB Atlas cluster URI is required for database operations.',
      dbStatus,
    });
  }
  next();
}
