/**
 * Authoritative Server-Side Audit Logger for Ship Asaan
 * Every critical mutation is permanently journaled with actor, action, and context.
 */

import { withTransaction, DatabaseSchema } from './db.js';
import { generateId } from './security.js';

export interface AuditLogInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

export async function logAudit(input: AuditLogInput, existingDb?: DatabaseSchema): Promise<void> {
  // Sanitize metadata to never include passwords, OTPs, or auth secrets
  const sanitizedMeta = { ...(input.metadata || {}) };
  delete sanitizedMeta.password;
  delete sanitizedMeta.password_hash;
  delete sanitizedMeta.password_salt;
  delete sanitizedMeta.token;
  delete sanitizedMeta.otp;
  delete sanitizedMeta.otp_hash;
  delete sanitizedMeta.smtp_pass;

  const record = {
    id: generateId('audit'),
    actor_id: input.actorId || null,
    actor_email: input.actorEmail || null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    metadata: sanitizedMeta,
    ip_address: input.ipAddress,
    created_at: new Date().toISOString()
  };

  if (existingDb) {
    existingDb.audit_logs.push(record);
    return;
  }

  await withTransaction((db) => {
    db.audit_logs.push(record);
  });
}
