import { getRequestConfig } from 'next-intl/server';
import messagesAr from '../../locales/ar.json';
import messagesEn from '../../locales/en.json';
import messagesFr from '../../locales/fr.json';

const MESSAGES = { fr: messagesFr, ar: messagesAr, en: messagesEn } as const;
type AppLocale = keyof typeof MESSAGES;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: AppLocale = requested === 'ar' ? 'ar' : requested === 'en' ? 'en' : 'fr';
  return { locale, messages: MESSAGES[locale] };
});
