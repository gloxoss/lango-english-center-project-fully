import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, teacherImportSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

function generateEmployeeId(): string {
  const year = new Date().getFullYear();
  return `ENS-${year}-${Math.floor(100 + Math.random() * 900)}`;
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'teachers.create');
    const body = await parseJson(request, teacherImportSchema);

    const results: { line: number; status: 'inserted' | 'error'; message?: string; id?: string }[] = [];

    for (const [index, row] of body.rows.entries()) {
      const line = index + 1;
      try {
        const id = `TCH-${Date.now()}-${index}`;
        const [inserted] = await db
          .insert(user)
          .values({
            id,
            tenantId,
            name: row.fullName,
            email: row.email || `${id.toLowerCase()}@schoolos.ma`,
            phone: row.phone,
            role: 'teacher',
            employeeId: generateEmployeeId(),
            specialization: row.specialization,
            userStatus: 'active',
          })
          .returning({ id: user.id });

        recordAudit(context, 'create', 'teacher', inserted!.id, { source: 'import', line });
        results.push({ line, status: 'inserted', id: inserted!.id });
      } catch (err) {
        console.error('Teacher import row failed', { line, err });
        results.push({ line, status: 'error', message: 'Échec de l\'insertion (email en doublon ou donnée invalide).' });
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
