'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, X } from 'lucide-react';

// Persistent impersonation banner (audit 2026-09-22, P1-2): while a super
// admin is acting inside a school, every dashboard page says so and offers a
// one-click exit. The state comes from the server because the active-tenant
// cookie is httpOnly.

export function ImpersonationBanner({ locale }: { locale: string }) {
  const [tenantName, setTenantName] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch('/api/super-admin/tenant-context')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && json.data?.activeTenantId) {
          setTenantName(json.data.tenantName ?? 'Établissement');
        } else {
          setTenantName(null);
        }
      })
      .catch(() => setTenantName(null));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('portal:role-changed', refresh);
    return () => window.removeEventListener('portal:role-changed', refresh);
  }, [refresh]);

  if (!tenantName) {
    return null;
  }

  const handleExit = () => {
    fetch('/api/super-admin/tenant-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: null }),
    })
      .then(() => {
        window.dispatchEvent(new CustomEvent('portal:role-changed', { detail: { tenantId: null } }));
        window.location.href = `/${locale}/dashboard/super-admin`;
      })
      .catch(() => {});
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-400 text-amber-950 px-4 lg:px-6 py-1.5 text-xs font-bold shadow-2xs">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">
          Vous êtes dans <strong className="font-extrabold">{tenantName}</strong> — accès plateforme journalisé (CNDP)
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-lg bg-amber-950/10 hover:bg-amber-950/20 transition-colors cursor-pointer"
      >
        <X className="w-3 h-3" />
        <span>Sortir</span>
      </button>
    </div>
  );
}
