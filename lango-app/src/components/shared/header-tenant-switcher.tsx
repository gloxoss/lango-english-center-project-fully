'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, Check, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

type SchoolItem = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
};

// Super-admin tenant switch (audit 2026-09-22, P1-2). The cookie is written
// exclusively by POST /api/super-admin/tenant-context: server-validated,
// httpOnly, 8-hour expiry, audit-logged with a reason. This component never
// touches document.cookie.

export function HeaderTenantSwitcher({ locale }: { locale: string }) {
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadSchools = () => {
    fetch('/api/super-admin/schools')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && Array.isArray(json.data)) {
          const list: SchoolItem[] = json.data.filter((s: any) => s.isActive !== false);
          setSchools(list);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));

    // The active tenant lives in an httpOnly cookie only the server can read.
    fetch('/api/super-admin/tenant-context')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setActiveTenantId(json.data.activeTenantId ?? null);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadSchools();
    const handlePortalChange = () => {
      fetch('/api/super-admin/tenant-context')
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.success) setActiveTenantId(json.data.activeTenantId ?? null);
        })
        .catch(() => {});
    };
    window.addEventListener('portal:role-changed', handlePortalChange);
    return () => window.removeEventListener('portal:role-changed', handlePortalChange);
  }, []);

  if (!loaded || schools.length === 0) {
    return null;
  }

  const activeSchool = schools.find((s) => s.id === activeTenantId) ?? null;

  const handleSelectSchool = (school: SchoolItem) => {
    void (async () => {
      try {
        const res = await fetch('/api/super-admin/tenant-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: school.id }),
        });
        if (!res.ok) {
          return; // Switch refused — leave state untouched.
        }
        setActiveTenantId(school.id);
        window.dispatchEvent(new CustomEvent('portal:role-changed', { detail: { tenantId: school.id } }));
        router.refresh();
        window.location.href = `/${locale}/dashboard`;
      } catch {
        // Network failure — leave state untouched.
      }
    })();
  };

  const handleClearSchool = () => {
    void (async () => {
      try {
        const res = await fetch('/api/super-admin/tenant-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: null }),
        });
        if (!res.ok) {
          return; // Exit refused — leave state untouched.
        }
        setActiveTenantId(null);
        window.dispatchEvent(new CustomEvent('portal:role-changed', { detail: { tenantId: null } }));
        router.refresh();
        window.location.href = `/${locale}/dashboard/super-admin`;
      } catch {
        // Network failure — leave state untouched.
      }
    })();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all outline-hidden cursor-pointer shadow-2xs group ${
          activeSchool
            ? 'border-amber-300/90 bg-amber-50/90 hover:bg-amber-100 text-amber-950'
            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
        }`}
        title={
          activeSchool
            ? `Établissement actif : ${activeSchool.name}`
            : 'Mode Plateforme Globale (Aucun établissement sélectionné)'
        }
      >
        <div className="flex items-center gap-1.5">
          {activeSchool ? (
            <Building2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          ) : (
            <Globe className="w-3.5 h-3.5 text-[#0066FF] shrink-0" />
          )}
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 hidden xl:inline">
            {activeSchool ? 'École :' : 'Portée :'}
          </span>
          <span className="truncate max-w-[140px] text-[#16212B]">
            {activeSchool ? activeSchool.name : 'Plateforme Globale'}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-transform shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="w-72 p-2 rounded-2xl shadow-xl border border-slate-200 bg-white">
        <DropdownMenuLabel className="px-2 py-1.5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Portée d&apos;administration (Super Admin)
          </p>
          <p className="text-xs text-slate-500 font-normal mt-0.5 leading-snug">
            Sélectionnez une école pour inspecter ses modules et données, ou restez en mode global. Chaque accès est journalisé (8 h max).
          </p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-1.5" />

        <DropdownMenuItem
          onClick={handleClearSchool}
          className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer ${
            !activeSchool ? 'bg-blue-50 font-bold text-[#0066FF]' : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#0066FF]" />
            <div>
              <p className="font-bold text-[#16212B]">Mode Plateforme Globale</p>
              <p className="text-[10px] text-slate-400">Aucun établissement / Modules masqués</p>
            </div>
          </div>
          {!activeSchool && <Check className="w-4 h-4 text-[#0066FF]" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1.5" />

        <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Établissements disponibles
        </div>

        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {schools.map((school) => {
            const isSelected = activeTenantId === school.id;
            return (
              <DropdownMenuItem
                key={school.id}
                onClick={() => handleSelectSchool(school)}
                className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer ${
                  isSelected ? 'bg-amber-50 font-bold text-amber-950' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-700' : 'text-slate-400'}`} />
                  <div className="truncate">
                    <p className="truncate font-semibold text-[#16212B]">{school.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{school.slug}</p>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-amber-700 shrink-0 ms-2" />}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
