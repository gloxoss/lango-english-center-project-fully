// organization-page.tsx
// SERVER COMPONENT — fetches initial settings + tenant logo status server-side,
// and passes them to the OrganizationFormClient island.
import { getServerUserContext } from '@/libs/auth/server-context';
import { db } from '@/libs/DB';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import { schoolSettings, tenants } from '@/models/Schema';
import { OrganisationFormClient, OrganisationFormData } from './organization-form-client';

const DEFAULT_FORM_DATA: OrganisationFormData = {
  establishmentName: '',
  shortName: '',
  city: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  country: 'Maroc',
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

export async function OrganizationPage() {
  let initialData = { ...DEFAULT_FORM_DATA };
  let hasLogo = false;
  let hasFavicon = false;

  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;

  try {
    const [settingRow] = await db.select().from(schoolSettings).limit(1);
    if (settingRow) {
      initialData = {
        establishmentName: settingRow.establishmentName ?? '',
        shortName: settingRow.shortName ?? '',
        city: settingRow.city ?? '',
        address: settingRow.address ?? '',
        phone: settingRow.phone ?? '',
        email: settingRow.email ?? '',
        website: settingRow.website ?? '',
        country: settingRow.country ?? 'Maroc',
        rc: settingRow.rc ?? '',
        ice: settingRow.ice ?? '',
        taxId: settingRow.taxId ?? '',
        legalStatus: settingRow.legalStatus ?? '',
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
        presenceModes: (settingRow.presenceModes as Record<string, boolean>) ?? DEFAULT_FORM_DATA.presenceModes,
        languages: (settingRow.languages as Record<string, boolean>) ?? DEFAULT_FORM_DATA.languages,
        security: (settingRow.security as Record<string, boolean>) ?? DEFAULT_FORM_DATA.security,
        localeTimezone: settingRow.localeTimezone ?? 'Africa/Casablanca',
        dateFormat: settingRow.dateFormat ?? 'dd/mm/yyyy',
        documentHeaderStyle: (settingRow.documentHeaderStyle as 'classique' | 'minimal' | 'moderne') ?? 'classique',
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
      initialData.presenceModes = (presEff.value as Record<string, boolean>) ?? initialData.presenceModes;
      initialData.languages = (langEff.value as Record<string, boolean>) ?? initialData.languages;
      initialData.security = (secEff.value as Record<string, boolean>) ?? initialData.security;
      initialData.localeTimezone = (tzEff.value as string) ?? initialData.localeTimezone;
    }

    const [tenantRow] = await db.select({ logoUrl: tenants.logoUrl, faviconUrl: tenants.faviconUrl }).from(tenants).limit(1);
    hasLogo = Boolean(tenantRow?.logoUrl);
    hasFavicon = Boolean(tenantRow?.faviconUrl);
  } catch (err) {
    console.error('Failed to pre-fetch organization settings server-side:', err);
  }

  return (
    <OrganisationFormClient
      initialData={initialData}
      hasLogo={hasLogo}
      hasFavicon={hasFavicon}
    />
  );
}
