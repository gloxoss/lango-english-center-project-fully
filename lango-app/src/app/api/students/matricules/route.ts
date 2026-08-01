import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { namingSeries } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const year = new Date().getFullYear();
    const prefix = `STD-${year}-`;

    const nextMatricule = await db.transaction(async (tx) => {
      const [series] = await tx
        .select()
        .from(namingSeries)
        .where(and(eq(namingSeries.prefix, prefix), eq(namingSeries.tenantId, tenantId)))
        .limit(1);

      let currentVal = 1;
      if (series) {
        currentVal = series.currentVal + 1;
        await tx
          .update(namingSeries)
          .set({ currentVal })
          .where(and(eq(namingSeries.prefix, prefix), eq(namingSeries.tenantId, tenantId)));
      } else {
        await tx.insert(namingSeries).values({
          prefix,
          tenantId,
          currentVal: 1,
        });
      }

      const formattedNumber = String(currentVal).padStart(4, '0');
      return `${prefix}${formattedNumber}`;
    });

    recordAudit(context, 'create', 'naming_series', prefix);

    return NextResponse.json({
      success: true,
      matricule: nextMatricule,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
