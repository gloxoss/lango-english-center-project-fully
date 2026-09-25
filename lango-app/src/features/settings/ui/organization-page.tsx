import type { OrganisationFormData } from './organization-form-client';
// organization-page.tsx
// SERVER COMPONENT — fetches initial settings + tenant logo status server-side,
// and passes them to the OrganizationFormClient island.
import { eq } from 'drizzle-orm';
import { brandingFileKey, uploadedFileExists } from '@/libs/api/uploads';
import { getServerUserContext } from '@/libs/auth/server-context';
import { db } from '@/libs/DB';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import { schoolSettings, tenants } from '@/models/Schema';
import { OrganisationFormClient } from './organization-form-client';

const DEFAULT_FORM_DATA: OrganisationFormData = {
  establishmentName: '',
  shortName: '',
  city: '',
  address: '',
  academicYear: '',
  startDate: '',
  endDate: '',
  phone: '',
  email: '',
  website: '',
  country: 'Maroc',
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
  presenceModes: {
    presence: true,
    retard: true,
    absenceJustifiee: true,
    absenceNonJustifiee: true,
    sortieAnticipee: true,
  },
  languages: { francais: true, arabe: true, anglais: false },
  security: { twoFa: true, strongPassword: true, auditLog: true, autoBackup: true },
  localeTimezone: 'Africa/Casablanca',
  dateFormat: 'dd/mm/yyyy',
  documentHeaderStyle: 'classique',
};

function normalizePresenceModes(value: unknown): Record<string, boolean> {
  if (Array.isArray(value)) {
    const enabled = Object.fromEntries(value.filter((key): key is string => typeof key === 'string' && key.length <= 50).map(key => [key, true]));
    return { ...DEFAULT_FORM_DATA.presenceModes, ...enabled };
  }
  if (value && typeof value === 'object') {
    const flags = Object.fromEntries(Object.entries(value).filter(([key, enabled]) => key.length <= 50 && typeof enabled === 'boolean'));
    return { ...DEFAULT_FORM_DATA.presenceModes, ...flags };
  }
  return { ...DEFAULT_FORM_DATA.presenceModes };
}

function normalizeDocumentStyle(value: unknown): OrganisationFormData['documentHeaderStyle'] {
  if (value === 'modern' || value === 'moderne') {
    return 'moderne';
  }
  if (value === 'minimal') {
    return 'minimal';
  }
  return 'classique';
}

export async function OrganizationPage() {
  let initialData = { ...DEFAULT_FORM_DATA };
  let hasLogo = false;
  let hasFavicon = false;

  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;
  if (!tenantId) {
    throw new Error('Tenant context required for organization settings');
  }

  try {
    // Scoped to the caller's tenant. Both reads below used a bare LIMIT 1 with
    // no WHERE, so they took whichever row the database returned first: on a
    // multi-tenant database that pre-fills the form with another school's
    // establishment name, ICE, and director/finance contact details.
    const [settingRow] = tenantId
      ? await db.select().from(schoolSettings).where(eq(schoolSettings.tenantId, tenantId)).limit(1)
      : [];
    if (settingRow) {
      initialData = {
        establishmentName: settingRow.establishmentName ?? '',
        shortName: settingRow.shortName ?? '',
        city: settingRow.city ?? '',
        address: settingRow.address ?? '',
        academicYear: settingRow.academicYear ?? '',
        startDate: settingRow.startDate ?? '',
        endDate: settingRow.endDate ?? '',
        phone: settingRow.phone ?? '',
        email: settingRow.email ?? '',
        website: settingRow.website ?? '',
        country: settingRow.country ?? 'Maroc',
        rc: settingRow.rc ?? '',
        ice: settingRow.ice ?? '',
        taxId: settingRow.taxId ?? '',
        legalStatus: settingRow.legalStatus ?? '',
        menAuthorizationNumber: settingRow.menAuthorizationNumber ?? '',
        regionalAcademy: settingRow.regionalAcademy ?? '',
        provincialDirection: settingRow.provincialDirection ?? '',
        officialStampUrl: settingRow.officialStampUrl ?? '',
        directorSignatureUrl: settingRow.directorSignatureUrl ?? '',
        directorName: settingRow.directorName ?? '',
        directorEmail: settingRow.directorEmail ?? '',
        directorPhone: settingRow.directorPhone ?? '',
        financialContactName: settingRow.financialContactName ?? '',
        financialContactEmail: settingRow.financialContactEmail ?? '',
        financialContactPhone: settingRow.financialContactPhone ?? '',
        admissionsContactName: settingRow.admissionsContactName ?? '',
        admissionsContactEmail: settingRow.admissionsContactEmail ?? '',
        admissionsContactPhone: settingRow.admissionsContactPhone ?? '',
        allowOperations: settingRow.allowOperations ?? true,
        presenceModes: normalizePresenceModes(settingRow.presenceModes),
        languages: (settingRow.languages as Record<string, boolean>) ?? DEFAULT_FORM_DATA.languages,
        security: (settingRow.security as Record<string, boolean>) ?? DEFAULT_FORM_DATA.security,
        localeTimezone: settingRow.localeTimezone ?? 'Africa/Casablanca',
        dateFormat: ['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'].includes(settingRow.dateFormat?.toLowerCase() ?? '')
          ? settingRow.dateFormat!.toLowerCase()
          : 'dd/mm/yyyy',
        documentHeaderStyle: normalizeDocumentStyle(settingRow.documentHeaderStyle),
      };
    }

    // The registry is the source of truth for the JSON-blob fields that
    // migrated to typed settings; the legacy row above only carries them until
    // the tenant's first save. Fall back to the legacy column when unset.
    if (tenantId) {
      const [presEff, langEff, secEff, tzEff] = await Promise.all([
        getEffectiveValueWithLegacyFallback(tenantId, ctx?.branchId ?? null, 'attendance.presenceModes'),
        getEffectiveValueWithLegacyFallback(tenantId, ctx?.branchId ?? null, 'localization.languages'),
        getEffectiveValueWithLegacyFallback(tenantId, ctx?.branchId ?? null, 'security.policies'),
        getEffectiveValueWithLegacyFallback(tenantId, ctx?.branchId ?? null, 'localization.timezone'),
      ]);
      initialData.presenceModes = normalizePresenceModes(presEff.value ?? initialData.presenceModes);
      initialData.languages = (langEff.value as Record<string, boolean>) ?? initialData.languages;
      initialData.security = (secEff.value as Record<string, boolean>) ?? initialData.security;
      initialData.localeTimezone = (tzEff.value as string) ?? initialData.localeTimezone;
    }

    // hasLogo must mean "there is an image to show", not "the column is set".
    // A non-empty logoUrl with no file behind it made this page render an <img>
    // pointing at /api/settings/logo, which can only answer 404 - the failing
    // request the UI audit caught on /dashboard/settings/onboarding. The file
    // is the source of truth; the column is only a claim.
    const [tenantRow] = tenantId
      ? await db.select({ logoUrl: tenants.logoUrl, faviconUrl: tenants.faviconUrl }).from(tenants).where(eq(tenants.id, tenantId)).limit(1)
      : [];

    if (tenantRow?.logoUrl) {
      hasLogo = await uploadedFileExists(tenantId!, brandingFileKey(tenantRow.logoUrl, 'logo'));
    }
    if (tenantRow?.faviconUrl) {
      hasFavicon = await uploadedFileExists(tenantId!, brandingFileKey(tenantRow.faviconUrl, 'favicon'));
    }
  } catch (err) {
    console.error('Failed to pre-fetch organization settings server-side:', err);
    throw err;
  }

  return (
    <OrganisationFormClient
      initialData={initialData}
      hasLogo={hasLogo}
      hasFavicon={hasFavicon}
    />
  );
}
