'use client';

import { useState, type ReactNode } from 'react';
import { SidebarDrawerContext } from './sidebar-drawer-context';

// Responsive shell around the shared dashboard: the sidebar renders as a
// static column on `lg+` (unchanged) and as a slide-in drawer on mobile so the
// content column gets the full viewport width. `dir` follows the locale so the
// drawer slides in from the logical start (right for Arabic/RTL). The header's
// mobile hamburger opens the drawer through SidebarDrawerContext.
export function DashboardShell({
  sidebar,
  header,
  children,
  locale,
}: {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  locale: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <SidebarDrawerContext.Provider value={{ available: true, open, setOpen }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#0066FF] focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Aller au contenu principal
      </a>
      <div dir={locale === 'ar' ? 'rtl' : 'ltr'} className="flex min-h-screen bg-slate-50">
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
        )}

        <div
          className={`fixed inset-y-0 z-50 w-64 shrink-0 transition-[inset-inline-start] duration-200 lg:static lg:z-auto ${
            open ? 'start-0' : '-start-64'
          }`}
        >
          {sidebar}
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {header}
          <main id="main-content" tabIndex={-1} className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarDrawerContext.Provider>
  );
}
