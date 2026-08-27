import { getRequestConfig } from 'next-intl/server';
import messagesAr from '../../locales/ar.json';
import messagesFr from '../../locales/fr.json';

// next-intl request config (W9). The app serves `fr` by default and `ar` for
// RTL; `en` exists in locales/ but the [locale] layout clamps to fr|ar.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested === 'ar' ? 'ar' : 'fr';
  return { locale, messages: locale === 'ar' ? messagesAr : messagesFr };
});
