'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cndpStatusOf, type CndpStatusView } from '@/features/settings/cndp-status';

const TONE: Record<CndpStatusView['tone'], string> = {
  good: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  progress: 'bg-blue-100 text-blue-800 border-blue-200',
  none: 'bg-slate-200 text-slate-700 border-slate-300',
  unknown: 'bg-amber-100 text-amber-800 border-amber-200',
};

/**
 * The tenant's real CNDP filing status, read from the registry instead of
 * asserted in copy.
 *
 * `enabled` decides whether the viewer may read the filing at all. It is false
 * for everyone who cannot, so no request is made and no 403 is generated: the
 * server still enforces the capability, this only avoids asking a question the
 * answer must be no to. When the registry cannot be read the badge says so
 * rather than falling back to a compliance claim.
 */
export function CndpStatusBadge({ enabled = false }: { enabled?: boolean } = {}) {
  const [status, setStatus] = useState<CndpStatusView | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      return;
    }
    let cancelled = false;

    fetch('/api/settings/cndp-filing', { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          // Not for this viewer: family accounts have no business reading the
          // school's filing, so no badge at all.
          setStatus(null);
          return;
        }
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          setStatus(cndpStatusOf(null, true));
          return;
        }
        setStatus(cndpStatusOf(json?.data?.status ?? null));
      })
      .catch(() => {
        if (!cancelled) setStatus(cndpStatusOf(null, true));
      });

    return () => { cancelled = true; };
  }, [enabled]);

  if (!status) return null;

  return (
    <span
      className={`hidden lg:inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONE[status.tone]}`}
      title="Statut de la déclaration CNDP (loi 09-08) de l'établissement"
    >
      <ShieldCheck className="w-3 h-3" />
      CNDP : {status.label}
    </span>
  );
}
