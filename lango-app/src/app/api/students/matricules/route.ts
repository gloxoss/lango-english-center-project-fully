import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { previewMatricule, reserveMatricule } from '@/libs/services/matricule';

// GET is a non-mutating preview: it returns the next matricule that *would* be
// reserved without touching the counter. The actual reservation moved to POST.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const nextMatricule = await previewMatricule(db, tenantId);

    return NextResponse.json({
      success: true,
      matricule: nextMatricule,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST actually reserves (increments and persists) the next matricule.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const nextMatricule = await db.transaction(tx => reserveMatricule(tx, tenantId));

    recordAudit(context, 'create', 'naming_series', `STD-${new Date().getFullYear()}-`);

    return NextResponse.json({
      success: true,
      matricule: nextMatricule,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
