import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { assertStudentCapacity } from '@/features/subscriptions/services/plan-limits-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, studentImportSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { logger } from '@/libs/logger';
import { reserveMatricule } from '@/libs/services/matricule';
import { classes, classSections, sections, user } from '@/models/Schema';

const MASSAR_CODE_REGEX = /^[A-Z]\d{9}$/i;

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.import');
    const body = await parseJson(request, studentImportSchema);

    await assertStudentCapacity(tenantId, body.rows.length);

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

        // Authoritative sequential matricule: use provided or generate via reserveMatricule
        let matricule = row.matricule?.trim() || null;
        if (!matricule) {
          matricule = await reserveMatricule(db, tenantId);
        } else {
          // If provided, verify no duplicate inside this tenant
          const [dupMat] = await db
            .select({ id: user.id })
            .from(user)
            .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.matricule, matricule)))
            .limit(1);
          if (dupMat) {
            results.push({ line, status: 'error', message: `Matricule "${matricule}" déjà utilisé dans cet établissement.` });
            continue;
          }
        }

        // Code Massar validation & normalization
        const cleanMassar = (row.codeMassar || row.nationalId)?.trim().toUpperCase() || null;
        if (cleanMassar) {
          if (!MASSAR_CODE_REGEX.test(cleanMassar)) {
            results.push({ line, status: 'error', message: `Code Massar "${cleanMassar}" invalide (format attendu : 1 lettre + 9 chiffres).` });
            continue;
          }
          const [dupMassar] = await db
            .select({ id: user.id })
            .from(user)
            .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.nationalId, cleanMassar)))
            .limit(1);
          if (dupMassar) {
            results.push({ line, status: 'error', message: `Code Massar "${cleanMassar}" déjà attribué dans cet établissement.` });
            continue;
          }
        }

        const [inserted] = await db
          .insert(user)
          .values({
            id,
            tenantId,
            branchId: context.branchId || null,
            name: row.fullName,
            matricule,
            nationalId: cleanMassar,
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

        recordAudit(context, 'create', 'student', inserted!.id, { source: 'import', line, matricule, nationalId: cleanMassar });
        results.push({ line, status: 'inserted', id: inserted!.id });
      } catch (err) {
        logger.error({ err, line }, 'Import row failed');
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
