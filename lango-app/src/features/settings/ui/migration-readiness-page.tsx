// migration-readiness-page.tsx
// SERVER COMPONENT — pre-fetches the tenant's real migration readiness state,
// computed from the database (students/classes/files) and the stored migration config.
import { getServerUserContext } from '@/libs/auth/server-context';
import type { RequestContext } from '@/libs/api/context';
import {
  buildMigrationReadiness, type MigrationReadinessData,
} from '@/libs/services/migration-readiness';
import { MigrationReadinessClient } from './migration-readiness-client';

export async function MigrationReadinessPage({ locale }: { locale?: string } = {}) {
  let initialData: MigrationReadinessData | null = null;

  try {
    const ctx = await getServerUserContext();
    if (ctx?.tenantId) {
      const auditCtx: RequestContext = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        branchId: ctx.branchId,
        role: ctx.role,
        baseRole: ctx.baseRole,
        name: ctx.name ?? '',
        email: ctx.email ?? '',
      };
      initialData = await buildMigrationReadiness(auditCtx);
    }
  } catch (err) {
    console.error('Failed to pre-fetch migration readiness server-side:', err);
  }

  return <MigrationReadinessClient initialData={initialData} locale={locale} />;
}
