import { AuditLogModel } from '../database/models/AuditLog';

interface AuditLogParams {
  action: string;
  module: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  details: string;
  recordId?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

/**
 * Sanitizes metadata to prevent passwords, tokens, API keys or secrets from ever being stored.
 */
function sanitizeMetadata(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMetadata);

  const sensitiveKeys = ['password', 'token', 'jwt', 'secret', 'key', 'auth', 'hash', 'credential'];
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Safely persists an administrative activity log to MongoDB Atlas.
 */
export async function logAuditActivity({
  action,
  module,
  actorName,
  actorEmail,
  actorRole,
  details,
  recordId,
  ipAddress,
  metadata,
}: AuditLogParams): Promise<void> {
  try {
    const safeMetadata = metadata ? sanitizeMetadata(metadata) : undefined;
    await AuditLogModel.create({
      action: action.toUpperCase().trim(),
      module: module.trim(),
      actorName: actorName || 'System Admin',
      actorEmail: actorEmail ? actorEmail.toLowerCase().trim() : 'system@novaracommerce.com',
      actorRole: actorRole || 'admin',
      details: details.trim(),
      recordId: recordId ? String(recordId) : undefined,
      ipAddress: ipAddress || '127.0.0.1',
      metadata: safeMetadata,
      timestamp: new Date(),
    });
  } catch (err: any) {
    console.warn('[AuditLogger] Warning: Failed to record audit log:', err.message);
  }
}
