'use client';

import { createContext, useContext } from 'react';

// Lets the shared Header's mobile hamburger open the sidebar drawer owned by
// DashboardShell, without crossing the server/client component boundary (the
// dashboard layout is a server component and cannot pass callbacks into a
// client component).
export const SidebarDrawerContext = createContext<{
  available: boolean;
  open: boolean;
  setOpen: (value: boolean) => void;
}>({ available: false, open: false, setOpen: () => {} });

export function useSidebarDrawer() {
  return useContext(SidebarDrawerContext);
}
