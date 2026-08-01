'use client';

import { usePathname, useRouter } from 'next/navigation';

export function LocaleSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSwitch = (newLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium text-slate-600">
      <button
        onClick={() => handleSwitch('fr')}
        className={`rounded-md px-2 py-1 transition-all ${
          currentLocale === 'fr' ? 'bg-white font-semibold text-[#0F382C] shadow-xs' : 'hover:text-slate-900'
        }`}
      >
        FR
      </button>
      <button
        onClick={() => handleSwitch('ar')}
        className={`rounded-md px-2 py-1 transition-all ${
          currentLocale === 'ar' ? 'bg-white font-semibold text-[#0F382C] shadow-xs' : 'hover:text-slate-900'
        }`}
      >
        العربية
      </button>
      <button
        onClick={() => handleSwitch('en')}
        className={`rounded-md px-2 py-1 transition-all ${
          currentLocale === 'en' ? 'bg-white font-semibold text-[#0F382C] shadow-xs' : 'hover:text-slate-900'
        }`}
      >
        EN
      </button>
    </div>
  );
}
