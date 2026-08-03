import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, studentImportSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classes, classSections, sections, user } from '@/models/Schema';

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.import');
    const body = await parseJson(request, studentImportSchema);

    // Build a "2nde a" -> classSectionId lookup once, so each row's free-text
    // class label can be resolved without an N+1 query per row.
    const sectionRows = await db
      .select({ id: classSections.id, className: classes.name, sectionName: sections.name })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(eq(classSections.tenantId, tenantId));

    const labelToClassSectionId = new Map<string, string>();
    for (const row of sectionRows) {
      labelToClassSectionId.set(normalizeLabel(`${row.className} ${row.sectionName}`), row.id);
    }

    const results: { line: number; status: 'inserted' | 'error'; message?: string; id?: string }[] = [];

    for (const [index, row] of body.rows.entries()) {
      const line = index + 1;
      try {
        const id = `STU-${Date.now()}-${index}`;
        const classSectionId = row.classLabel ? labelToClassSectionId.get(normalizeLabel(row.classLabel)) ?? null : null;

        const [inserted] = await db
          .insert(user)
          .values({
            id,
            tenantId,
            branchId: context.branchId || null,
            name: row.fullName,
            email: row.email || `${id.toLowerCase()}@placeholder.local`,
            role: 'student',
            classSectionId,
            dateOfBirth: row.dateOfBirth,
            guardianName: row.guardianName,
            guardianPhone: row.guardianPhone,
            phone: row.phone,
            userStatus: 'active',
          })
          .returning({ id: user.id });

        recordAudit(context, 'create', 'student', inserted!.id, { source: 'import', line });
        results.push({ line, status: 'inserted', id: inserted!.id });
      } catch (err) {
        console.error('Import row failed', { line, err });
        results.push({ line, status: 'error', message: 'Échec de l\'insertion (email en doublon ou donnée invalide).' });
      }
    }

    const insertedCount = results.filter(r => r.status === 'inserted').length;
    const errorCount = results.length - insertedCount;

    return NextResponse.json({
      success: true,
      insertedCount,
      errorCount,
      results,
      message: `${insertedCount} élève(s) importé(s)${errorCount > 0 ? `, ${errorCount} en erreur` : ''}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
