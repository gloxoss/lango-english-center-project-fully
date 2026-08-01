import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { attendance, classSections, invoices, payments, tenants, user } from '@/models/Schema';

const tenantBackupSchema = z.object({
  schoolId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    requireSuperAdmin(context);

    const body = await parseJson(request, tenantBackupSchema);

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, body.schoolId))
      .limit(1);

    if (!tenant) {
      throw new ApiError(404, 'NOT_FOUND', 'Établissement introuvable.');
    }

    const [usersList, sectionsList, invoicesList, paymentsList] = await Promise.all([
      db.select().from(user).where(eq(user.tenantId, body.schoolId)),
      db.select().from(classSections).where(eq(classSections.tenantId, body.schoolId)),
      db.select().from(invoices).where(eq(invoices.tenantId, body.schoolId)),
      db.select().from(payments).where(eq(payments.tenantId, body.schoolId)),
    ]);

    const backupDump = {
      version: '1.0',
      tenant,
      backupTimestamp: new Date().toISOString(),
      recordCounts: {
        users: usersList.length,
        classSections: sectionsList.length,
        invoices: invoicesList.length,
        payments: paymentsList.length,
      },
      tables: {
        user: usersList,
        classSections: sectionsList,
        invoices: invoicesList,
        payments: paymentsList,
      },
    };

    return new NextResponse(JSON.stringify(backupDump, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup-tenant-${tenant.slug}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
