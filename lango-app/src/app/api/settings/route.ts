import { logger } from '@/libs/logger';
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

/**
 * Fields whose value ends up printed on official documents. A change to any of
 * them is recorded with its before/after, because "the ICE on the certificate
 * changed and nobody knows when or to what" is unanswerable otherwise
 * (DISC-SETTINGS-CORE-01, auditability).
 */
const LEGAL_IDENTITY_FIELDS = [
  'ice',
  'rc',
  'taxId',
  'menAuthorizationNumber',
  'officialStampUrl',
  'directorSignatureUrl',
  'establishmentName',
  'legalStatus',
] as const;

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
          academicYear: '',
          startDate: null,
          endDate: null,
          phone: '',
          email: '',
          website: '',
          country: '',
          rc: '',
          ice: '',
          taxId: '',
          legalStatus: '',
          menAuthorizationNumber: '',
          regionalAcademy: '',
          provincialDirection: '',
          officialStampUrl: '',
          directorSignatureUrl: '',
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
      // academicYear / startDate / endDate are deliberately NOT written: the
      // school year lives in `session_years` and is read through
      // libs/services/school-year.ts (OD1). This page used to keep a second
      // copy that only the hub badge ever read. The columns stay in the table
      // and the schema stays permissive so older clients keep working.
      phone: body.phone,
      email: body.email,
      website: body.website,
      country: body.country,
      rc: body.rc,
      ice: body.ice,
      taxId: body.taxId,
      legalStatus: body.legalStatus,
      menAuthorizationNumber: body.menAuthorizationNumber,
      regionalAcademy: body.regionalAcademy,
      provincialDirection: body.provincialDirection,
      officialStampUrl: body.officialStampUrl,
      directorSignatureUrl: body.directorSignatureUrl,
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
      // presenceModes is NOT written here any more: the toggles moved to
      // /dashboard/settings/attendance (SCF-04) and that page writes the
      // registry key `attendance.presenceModes`, which is what every reader
      // consults. Leaving this write in place made the Organisation form a
      // second writer, so a stale tab could silently undo a change made on the
      // Attendance page. The body field is still accepted (schema permissive)
      // so an un-refreshed client does not 422.
      languages: body.languages ?? DEFAULT_LANGUAGES,
      security: body.security ?? DEFAULT_SECURITY,
      localeTimezone: body.localeTimezone,
      dateFormat: body.dateFormat,
      documentHeaderStyle: body.documentHeaderStyle,
      // attendanceLateGraceMinutes / attendancePeriodStartTime moved to the
      // Attendance settings page (SCF-04) and are no longer written here. The
      // schema still accepts them so an un-refreshed client does not 422.
      updatedAt: new Date().toISOString(),
    };

    // Read the row BEFORE the upsert so the audit can say what actually
    // changed. Legal-identity fields (ICE, RC, IF, MEN, stamp, signature)
    // decide what is printed on official documents; until now a change to any
    // of them left no trace at all.
    const [before] = await db
      .select()
      .from(schoolSettings)
      .where(eq(schoolSettings.tenantId, tenantId))
      .limit(1);

    const [saved] = await db
      .insert(schoolSettings)
      .values({ tenantId, ...sharedFields })
      .onConflictDoUpdate({
        target: schoolSettings.tenantId,
        set: sharedFields,
      })
      .returning();

    if (saved) {
      const changed: Record<string, { before: unknown; after: unknown }> = {};
      for (const field of LEGAL_IDENTITY_FIELDS) {
        const previous = before ? (before as Record<string, unknown>)[field] : null;
        const next = (saved as Record<string, unknown>)[field];
        // Unchanged fields are omitted entirely rather than recorded as
        // before === after: an audit row should show the edits, not the form.
        if (previous !== next) {
          changed[field] = { before: previous ?? null, after: next ?? null };
        }
      }

      recordAudit(
        context,
        'update',
        'school_settings',
        saved.id,
        Object.keys(changed).length > 0 ? { changed } : undefined,
      );
    }

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
          logger.error({ err: r.reason }, 'Settings dual-write failed (non-fatal)');
        }
      }
    });

    return NextResponse.json({ success: true, data: saved, message: 'Paramètres enregistrés avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
