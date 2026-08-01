import React from 'react';
import { MarketingHeader } from '@/features/marketing/ui/marketing-header';
import { MarketingFooter } from '@/features/marketing/ui/marketing-footer';

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="flex flex-col min-h-screen">
      <MarketingHeader currentLocale={locale} />
      <main className="flex-grow">{children}</main>
      <MarketingFooter currentLocale={locale} />
    </div>
  );
}
