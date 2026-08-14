'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { AppRole } from '@/libs/api/context';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  school_admin: 'Administrateur École',
  teacher: 'Enseignant',
  accountant: 'Comptable',
  student: 'Élève',
  parent: 'Tuteur',
  receptionist: 'Réceptionniste',
  guard: 'Gardien',
  librarian: 'Bibliothécaire',
};

/**
 * Server-validated active-role switcher. Visible only when the server reports
 * more than one switchable role (`availableRoles` from /api/portal/me). The
 * actual switch is POST /api/portal/role, which re-validates against the base
 * role + live derived identities; a forged role here is refused with 403.
 * On success we clear client-held auth-derived state (search/nav/permissions)
 * via a broadcast event and force a server refresh.
 */
export function PortalRoleSwitcher({
  availableRoles,
  activeRole,
  locale,
}: {
  availableRoles: AppRole[];
  activeRole: AppRole;
  locale: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (availableRoles.length <= 1) {
    return null;
  }

  async function onSwitch(role: AppRole) {
    setError(null);
    try {
      const res = await fetch('/api/portal/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? 'Échec du changement de rôle.');
        return;
      }
      window.dispatchEvent(new CustomEvent('portal:role-changed', { detail: { role } }));
      startTransition(() => {
        router.refresh();
        router.push(pathname);
      });
    } catch {
      setError('Erreur réseau. Réessayez.');
    }
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor="portal-role-switcher"
        className="block text-[11px] font-medium text-slate-400"
      >
        Changer de rôle
      </label>
      <select
        id="portal-role-switcher"
        value={activeRole}
        disabled={isPending}
        onChange={(e) => onSwitch(e.target.value as AppRole)}
        className="w-full cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/40"
        aria-label="Changer de rôle actif"
      >
        {availableRoles.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role] ?? role}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-[11px] text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
