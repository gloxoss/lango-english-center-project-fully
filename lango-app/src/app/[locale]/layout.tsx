import { LocaleProvider } from '@/features/marketing/context/locale-context';
import { AppProviders } from '@/providers';
import '../../../public/assets/css/fonts.css';
import '../globals.css';

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
          <LocaleProvider initialLocale={validLocale}>
            {children}
          </LocaleProvider>
        </AppProviders>
      </body>
    </html>
  );
}
