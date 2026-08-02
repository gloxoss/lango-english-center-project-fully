import { Cairo } from 'next/font/google';
import { LocaleProvider } from '@/features/marketing/context/locale-context';
import { AppProviders } from '@/providers';
import '../../../public/assets/css/fonts.css';
import '../globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

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
      className={`
        ${cairo.variable}
      `}
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
