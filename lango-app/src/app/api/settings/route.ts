import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson, settingsUpdateSchema } from '@/libs/api/validation';
import { SETTINGS_REGISTRY, setSettingValue } from '@/libs/settings/registry';
import { db } from '@/libs/DB';
import { schoolSettings } from '@/models/Schema';

const DEFAULT_PRESENCE_MODES = {
  presence: true,
  retard: true,
  absenceJustifiee: true,
  absenceNonJustifiee: true,
  sortieAnticipee: true,
};

const DEFAULT_LANGUAGES = { francais: true, arabe: true, anglais: false };
const DEFAULT_SECURITY = { twoFa: true, strongPassword: true, auditLog: true, autoBackup: true };

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const [row] = await db.select().from(schoolSettings).where(eq(schoolSettings.tenantId, tenantId)).limit(1);

    if (!row) {
      return NextResponse.json({
        success: true,
        data: {
          establishmentName: '',
          city: '',
          address: '',
          phone: '',
          email: '',
          academicYear: '',
          startDate: '',
          endDate: '',
          allowOperations: true,
          presenceModes: DEFAULT_PRESENCE_MODES,
          languages: DEFAULT_LANGUAGES,
          security: DEFAULT_SECURITY,
          ice: '',
          legalStatus: '',
          directorName: '',
        },
      });
    }

    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, settingsUpdateSchema);

    const [saved] = await db
      .insert(schoolSettings)
      .values({
        tenantId,
        establishmentName: body.establishmentName,
        city: body.city,
        address: body.address,
        phone: body.phone,
        email: body.email,
        academicYear: body.academicYear,
        startDate: body.startDate,
        endDate: body.endDate,
        allowOperations: body.allowOperations,
        presenceModes: body.presenceModes ?? DEFAULT_PRESENCE_MODES,
        languages: body.languages ?? DEFAULT_LANGUAGES,
        security: body.security ?? DEFAULT_SECURITY,
        ice: body.ice,
        legalStatus: body.legalStatus,
        directorName: body.directorName,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: schoolSettings.tenantId,
        set: {
          establishmentName: body.establishmentName,
          city: body.city,
          address: body.address,
          phone: body.phone,
          email: body.email,
          academicYear: body.academicYear,
          startDate: body.startDate,
          endDate: body.endDate,
          allowOperations: body.allowOperations,
          presenceModes: body.presenceModes ?? DEFAULT_PRESENCE_MODES,
          languages: body.languages ?? DEFAULT_LANGUAGES,
          security: body.security ?? DEFAULT_SECURITY,
          ice: body.ice,
          legalStatus: body.legalStatus,
          directorName: body.directorName,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    recordAudit(context, 'update', 'school_settings', saved!.id);

    // Dual-write: sync to new settingValues table. Fire-and-forget so a
    // failure in the new system never breaks the existing settings save.
    const legacyData = saved as Record<string, unknown>;
    // allSettled never rejects, so inspect the results - a .catch() here would
    // be dead code and silently swallow every dual-write failure.
    Promise.allSettled(
      SETTINGS_REGISTRY
        .filter(def => def.legacyField && legacyData[def.legacyField] !== undefined)
        .map(def => setSettingValue(tenantId, null, def.key, legacyData[def.legacyField!], context, 'dual-write from legacy settings')),
    ).then((results) => {
      for (const r of results) {
        if (r.status === 'rejected') {
          console.error('Settings dual-write failed (non-fatal)', r.reason);
        }
      }
    });

    return NextResponse.json({ success: true, data: saved, message: 'Paramètres enregistrés avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
