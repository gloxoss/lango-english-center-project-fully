// translations-custom-fields-page.tsx
// SERVER COMPONENT — pre-fetches the tenant-scoped i18n dictionary and custom fields,
// seeds them from the config on first load, and computes real language coverage.
import { getServerUserContext } from '@/libs/auth/server-context';
import { getEffectiveValue } from '@/libs/settings/registry';
import {
  I18N_DICTIONARY_KEYS, CUSTOM_FIELD_DEFINITIONS,
} from '@/features/settings/data/translations-custom-fields-config';
import {
  TranslationsCustomFieldsClient, I1nKeyItem, CustomFieldItem, LanguageCoverageItem,
} from './translations-custom-fields-client';

const LANG_META = {
  francais: { name: 'Français (Maroc)', flag: '🇫🇷', isRtl: false },
  arabe: { name: 'العربية (المغرب)', flag: '🇲🇦', isRtl: true },
  anglais: { name: 'English (US)', flag: '🇬🇧', isRtl: false },
} as const;

export async function TranslationsCustomFieldsPage({ locale }: { locale?: string } = {}) {
  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;

  let initialKeys: I1nKeyItem[] = Array.from(I18N_DICTIONARY_KEYS) as I1nKeyItem[];
  let initialFields: CustomFieldItem[] = Array.from(CUSTOM_FIELD_DEFINITIONS) as CustomFieldItem[];
  let enabledLanguageCount = 0;
  let enabledLanguageLabel = '';

  try {
    if (tenantId && ctx) {
      // Read-only: when the tenant has never customized translations, render the
      // config seed. Persistence happens on the first user edit (PATCH), never here.
      const effective = await getEffectiveValue(tenantId, ctx.branchId, 'i18n.translations');
      const stored = effective.source === 'default' ? {} : (effective.value as Record<string, unknown>);
      if (Array.isArray(stored.keys)) initialKeys = stored.keys as I1nKeyItem[];
      if (Array.isArray(stored.fields)) initialFields = stored.fields as CustomFieldItem[];

      // Enabled languages from the real localization setting.
      const langSetting = await getEffectiveValue(tenantId, ctx.branchId, 'localization.languages');
      const langValue = (langSetting.value ?? {}) as Record<string, boolean>;
      const enabled = (['francais', 'arabe', 'anglais'] as const).filter(c => langValue[c] !== false);
      enabledLanguageCount = enabled.length;
      enabledLanguageLabel = enabled.map(c => LANG_META[c].name.replace(/\(.*\)/, '').trim()).join(', ');
    }
  } catch (err) {
    console.error('Failed to pre-fetch translations server-side:', err);
  }

  // Real coverage computed from the actual dictionary (fr is the source language).
  const total = initialKeys.length;
  const arCount = initialKeys.filter(k => k.ar?.trim()).length;
  const enCount = initialKeys.filter(k => k.en?.trim()).length;
  const counts: Record<string, number> = { francais: total, arabe: arCount, anglais: enCount };
  const coverage: LanguageCoverageItem[] = (['francais', 'arabe', 'anglais'] as const).map(code => {
    const count = counts[code] ?? 0;
    return {
      code,
      name: LANG_META[code].name,
      flag: LANG_META[code].flag,
      isRtl: LANG_META[code].isRtl,
      count,
      total,
      coverage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  const reviewPendingCount = initialKeys.filter(k => k.status === 'review_pending').length;

  return (
    <TranslationsCustomFieldsClient
      initialKeys={initialKeys}
      initialFields={initialFields}
      initialCoverage={coverage}
      totalKeysCount={total}
      reviewPendingCount={reviewPendingCount}
      enabledLanguageCount={enabledLanguageCount}
      enabledLanguageLabel={enabledLanguageLabel}
    />
  );
}
