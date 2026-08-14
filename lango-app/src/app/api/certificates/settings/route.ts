import { count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import { tenants } from '@/models/Schema';
import {
  certificateDefinitions,
  certificateTemplates,
  certificateSignatories,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.templates.manage');

    const [tenant] = await db.select({ id: tenants.id, name: tenants.name }).from(tenants)
      .where(eq(tenants.id, tenantId)).limit(1);

    const [signatories, definitions, templates, issuedRows] = await Promise.all([
      db.select().from(certificateSignatories).where(eq(certificateSignatories.tenantId, tenantId)).orderBy(desc(certificateSignatories.createdAt)),
      db.select({ id: certificateDefinitions.id }).from(certificateDefinitions).where(eq(certificateDefinitions.tenantId, tenantId)),
      db.select({ id: certificateTemplates.id }).from(certificateTemplates).where(eq(certificateTemplates.tenantId, tenantId)),
      db.select({ count: sql<number>`count(*)` }).from(issuedCertificates).where(eq(issuedCertificates.tenantId, tenantId)),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        issuer: { name: tenant?.name ?? '', id: tenant?.id ?? '' },
        signatories,
        counts: {
          definitions: definitions.length,
          templates: templates.length,
          issued: Number(issuedRows[0]?.count ?? 0),
        },
        serialPrefix: 'CERT',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
