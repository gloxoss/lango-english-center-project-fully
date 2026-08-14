import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireCapability } from '@/libs/api/permissions';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson, settingsUpdateSchema } from '@/libs/api/validation';
import { LEGACY_SETTING_COLUMNS, SETTINGS_REGISTRY, getEffectiveValueWithLegacyFallback, setSettingValue } from '@/libs/settings/registry';
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
    await requireCapability(context, 'settings.read');
    const tenantId = requireTenant(context);

    const [row] = await db.select().from(schoolSettings).where(eq(schoolSettings.tenantId, tenantId)).limit(1);

    if (!row) {
      return NextResponse.json({
        success: true,
        data: {
          establishmentName: '',
          shortName: '',
          city: '',
          address: '',
          phone: '',
          email: '',
          website: '',
          country: '',
          rc: '',
          ice: '',
          taxId: '',
          legalStatus: '',
          directorName: '',
          directorEmail: '',
          directorPhone: '',
          financialContactName: '',
          financialContactEmail: '',
          financialContactPhone: '',
          admissionsContactName: '',
          admissionsContactEmail: '',
          admissionsContactPhone: '',
          allowOperations: true,
          presenceModes: DEFAULT_PRESENCE_MODES,
          languages: DEFAULT_LANGUAGES,
          security: DEFAULT_SECURITY,
          localeTimezone: 'Africa/Casablanca',
          dateFormat: 'dd/mm/yyyy',
          documentHeaderStyle: 'classique',
          attendanceLateGraceMinutes: 15,
          attendancePeriodStartTime: '08:00',
        },
      });
    }

    // Project only the fields the UI needs — never return tenantId or internal ids
    const {
      id: _id,
      tenantId: _tid,
      createdAt: _c,
      updatedAt: _u,
      ...publicFields
    } = row;

    // The registry is the source of truth for the fields migrated to typed
    // settings; the legacy schoolSettings row still carries the rest. When a
    // tenant has no override yet, getEffectiveValueWithLegacyFallback reads the
    // legacy column so existing data survives the split.
    const migratedDefs = SETTINGS_REGISTRY.filter(
      d => d.legacyField && Object.prototype.hasOwnProperty.call(LEGACY_SETTING_COLUMNS, d.legacyField),
    );
    const resolved = await Promise.all(
      migratedDefs.map(async (def) => [
        def.legacyField as string,
        (await getEffectiveValueWithLegacyFallback(tenantId, context.branchId, def.key)).value,
      ] as const),
    );

    return NextResponse.json({ success: true, data: { ...publicFields, ...Object.fromEntries(resolved) } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}


export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'settings.organization.manage');
    const tenantId = requireTenant(context);
    const body = await parseJson(request, settingsUpdateSchema);

    const sharedFields = {
      establishmentName: body.establishmentName,
      shortName: body.shortName,
      city: body.city,
      address: body.address,
      phone: body.phone,
      email: body.email,
      website: body.website,
      country: body.country,
      rc: body.rc,
      ice: body.ice,
      taxId: body.taxId,
      legalStatus: body.legalStatus,
      directorName: body.directorName,
      directorEmail: body.directorEmail,
      directorPhone: body.directorPhone,
      financialContactName: body.financialContactName,
      financialContactEmail: body.financialContactEmail,
      financialContactPhone: body.financialContactPhone,
      admissionsContactName: body.admissionsContactName,
      admissionsContactEmail: body.admissionsContactEmail,
      admissionsContactPhone: body.admissionsContactPhone,
      allowOperations: body.allowOperations,
      presenceModes: body.presenceModes ?? DEFAULT_PRESENCE_MODES,
      languages: body.languages ?? DEFAULT_LANGUAGES,
      security: body.security ?? DEFAULT_SECURITY,
      localeTimezone: body.localeTimezone,
      dateFormat: body.dateFormat,
      documentHeaderStyle: body.documentHeaderStyle,
      attendanceLateGraceMinutes: body.attendanceLateGraceMinutes ?? 15,
      attendancePeriodStartTime: body.attendancePeriodStartTime ?? '08:00',
      updatedAt: new Date().toISOString(),
    };

    const [saved] = await db
      .insert(schoolSettings)
      .values({ tenantId, ...sharedFields })
      .onConflictDoUpdate({
        target: schoolSettings.tenantId,
        set: sharedFields,
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

