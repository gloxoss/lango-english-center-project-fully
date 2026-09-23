import { NextResponse } from 'next/server';
import { z } from 'zod';
import { insertTeacherRecord } from '@/features/teachers/server/teacher-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { logger } from '@/libs/logger';

// Bulk teacher import.
//
// Each row goes through the same domain path as a single create (branch
// resolution/validation, duplicate email + employee-id checks, tenant-scoped
// employee id reservation, account-activation token when a phone is provided),
// so an import can never create a second identity for an existing teacher.
// Rows fail independently and the response reports exactly which line failed
// and why.

const importRowSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  email: z.email().max(255).optional(),
  phone: z.string().trim().max(50).optional(),
  specialization: z.string().trim().max(255).optional(),
  employeeId: z.string().trim().max(50).optional(),
}).strict();

const importBodySchema = z.object({
  rows: z.array(importRowSchema).min(1).max(500),
  branchId: z.string().uuid().nullable().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'teachers.create');
    const body = await parseJson(request, importBodySchema);

    const results: Array<{
      line: number;
      status: 'inserted' | 'error';
      id?: string;
      employeeId?: string;
      message?: string;
      code?: string;
    }> = [];

    for (const [index, row] of body.rows.entries()) {
      const line = index + 1;
      try {
        const created = await insertTeacherRecord(context, tenantId, {
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          specialization: row.specialization,
          employeeId: row.employeeId,
          branchId: body.branchId ?? null,
        });
        results.push({ line, status: 'inserted', id: created.id, employeeId: created.employeeId });
        recordAudit(context, 'import', 'teacher', created.id, {
          source: 'import',
          line,
          employeeId: created.employeeId,
          invitation: created.provisioning.deliveryStatus,
        });
      } catch (err) {
        logger.error({ err, line }, 'Teacher import row failed');
        const code = err instanceof ApiError ? err.code : 'IMPORT_ROW_FAILED';
        const message = err instanceof ApiError ? err.message : 'Échec de l\'insertion (donnée invalide).';
        results.push({ line, status: 'error', code, message });
      }
    }

    const importedCount = results.filter(r => r.status === 'inserted').length;
    const errorCount = results.length - importedCount;

    return NextResponse.json({
      success: true,
      importedCount,
      errorCount,
      results,
      message: `${importedCount} enseignant(s) importé(s)${errorCount > 0 ? `, ${errorCount} en erreur` : ''}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
