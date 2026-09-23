import type { RequestContext } from './context';
import { db } from '@/libs/DB';
import { logger } from '@/libs/logger';
import { auditLogs } from '@/models/Schema';

type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'settings_change'
  | 'permission_change'
  | 'entitlement_change'
  | 'impersonate_start'
  | 'impersonate_end';

/**
 * Fire-and-forget: a logging failure must never fail the request it is
 *  recording. Errors are swallowed after being logged server-side.
 *
 * Every row written while a super_admin is acting inside a selected tenant is
 * marked `impersonatedBySuperAdmin: true` — Law 09-08 / CNDP requires platform
 * access to a school's data (minors') to be identifiable as such
 * (audit 2026-09-22, P1-2).
 */
export function recordAudit(
  context: RequestContext,
  action: AuditAction,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): void {
  const impersonated = context.impersonated === true;
  db
    .insert(auditLogs)
    .values({
      tenantId: context.tenantId,
      actorId: context.userId,
      action,
      entityType,
      entityId,
      metadata: impersonated
        ? { ...metadata, impersonatedBySuperAdmin: true, actorRole: context.role }
        : metadata,
    })
    .catch((err) => {
      logger.error({ err, action, entityType, entityId }, 'Failed to record audit log');
    });
}
