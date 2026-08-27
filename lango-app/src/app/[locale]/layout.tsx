import { NextIntlClientProvider } from 'next-intl';
import { LocaleProvider } from '@/features/marketing/context/locale-context';
import { AppProviders } from '@/providers';
// W9: feed the locale bundles into the render tree. Before this, next-intl was
// installed but never wired — no provider, no messages — so /ar rendered RTL
// with hardcoded French. Client components can now useTranslations('Namespace').
import messagesFr from '../../../locales/fr.json';
import messagesAr from '../../../locales/ar.json';
import '../../../public/assets/css/fonts.css';
import '../globals.css';

const MESSAGES = { fr: messagesFr, ar: messagesAr } as const;

// Cairo loads at runtime via the Google Fonts @import in globals.css (same
// delivery as Albert Sans / Geist). It is intentionally NOT imported via
// next/font/google: that self-hosted build would fetch Google Fonts at
// `next build` time and fail when the network is unreachable.

export const metadata = {
  title: 'SchoolOS — Moroccan School Management Platform',
  description: 'Complete school management for Moroccan private K-12, language centers, and higher education.',
};

export default async function RootLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const validLocale = (locale === 'ar' ? 'ar' : 'fr') as 'fr' | 'ar';
  const isRTL = validLocale === 'ar';

  return (
    <html
      lang={validLocale}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <body className="min-h-screen bg-[#F8FAFC] text-slate-900 antialiased">
        <AppProviders>
          <NextIntlClientProvider locale={validLocale} messages={MESSAGES[validLocale]}>
            <LocaleProvider initialLocale={validLocale}>
              {children}
            </LocaleProvider>
          </NextIntlClientProvider>
        </AppProviders>
      </body>
    </html>
  );
}
