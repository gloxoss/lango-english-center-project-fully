import React from 'react';
import { MarketingFooter } from '@/features/marketing/ui/marketing-footer';
import { MarketingHeader } from '@/features/marketing/ui/marketing-header';
import '../../../../public/assets/css/grovia-template.webflow.shared.f6c6fca70.css';

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader currentLocale={locale} />
      <main className="grow">{children}</main>
      <MarketingFooter currentLocale={locale} />
    </div>
  );
}
