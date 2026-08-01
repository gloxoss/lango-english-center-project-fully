import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendance, classSections, invoices, payments, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const [students, teachers, sectionsList, invoicesList, paymentsList, attendanceList] = await Promise.all([
      db.select().from(user).where(eq(user.tenantId, tenantId)),
      db.select().from(user).where(eq(user.tenantId, tenantId)),
      db.select().from(classSections).where(eq(classSections.tenantId, tenantId)),
      db.select().from(invoices).where(eq(invoices.tenantId, tenantId)),
      db.select().from(payments).where(eq(payments.tenantId, tenantId)),
      db.select().from(attendance).where(eq(attendance.tenantId, tenantId)).limit(1000),
    ]);

    const exportObject = {
      tenantId,
      exportedAt: new Date().toISOString(),
      counts: {
        users: students.length,
        classSections: sectionsList.length,
        invoices: invoicesList.length,
        payments: paymentsList.length,
        attendance: attendanceList.length,
      },
      data: {
        users: students,
        classSections: sectionsList,
        invoices: invoicesList,
        payments: paymentsList,
        attendanceRecords: attendanceList,
      },
    };

    return new NextResponse(JSON.stringify(exportObject, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="data-export-${tenantId}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
