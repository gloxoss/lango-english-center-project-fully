'use client';

import { Building2, ChevronDown, Lock, Network } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getBranchPageMode } from '@/libs/api/branch-page-modes';

export type BranchItem = {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
};

type BranchScope = 'all' | 'pinned';

// THE authoritative global branch context. The chosen campus lives in the
// user's session ON THE SERVER (portal_active_contexts, set through POST
// /api/portal/branch) — never in the browser. Every staff surface derives its
// branch from the server context; picking a campus here reloads the page so
// every page re-reads it (DB5). The dashboard header renders no selector of
// its own.
export function HeaderCampusSwitcher() {
  const t = useTranslations('Common');
  const th = useTranslations('DashboardHome');
  const pathname = usePathname();
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [scope, setScope] = useState<BranchScope>('all');
  const [loaded, setLoaded] = useState(false);

  // What the switcher means on THIS page (B5-01): shared pages show a
  // "tenant-wide" pill, personal pages hide the switcher entirely.
  const pageMode = getBranchPageMode(pathname);

  useEffect(() => {
    fetch('/api/settings/branches')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && Array.isArray(json.data)) {
          setBranches(json.data);
          const serverScope: BranchScope = json.meta?.branchScope === 'pinned' ? 'pinned' : 'all';
          setScope(serverScope);
          // The server context is the single source: the active campus (or
          // null = "Tous les sites") comes from the session, not storage.
          setSelectedBranchId(json.meta?.activeBranchId ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return null;
  }

  // Personal page: the campus choice is meaningless here — no switcher.
  if (pageMode === 'personal') {
    return null;
  }

  // Shared page (or pinned scope or single-branch tenant): static pill.
  if (pageMode === 'shared' || scope === 'pinned' || branches.length <= 1) {
    const singleBranch = scope === 'pinned'
      ? branches.find(b => b.id === selectedBranchId)
      : branches[0];
    if (pageMode === 'shared' && scope !== 'pinned') {
      return (
        <div
          className="
            flex items-center gap-1.5 rounded-xl border border-slate-200/80
            bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-[#16212B]
          "
          title={t('allBranches')}
        >
          <Network className="size-3.5 text-slate-500" />
          <span className="max-w-[140px] truncate">{t('allBranches')}</span>
        </div>
      );
    }
    return (
      <div
        className="
          flex items-center gap-1.5 rounded-xl border border-slate-200/80
          bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-[#16212B]
        "
        title={scope === 'pinned' ? th('branchPinnedNote') : undefined}
      >
        <Building2 className="size-3.5 text-[#2487B8]" />
        <span className="max-w-[120px] truncate">
          {singleBranch ? singleBranch.name : t('allBranches')}
        </span>
        {singleBranch?.code && (
          <span className="
            rounded-sm bg-slate-200/60 px-1.5 py-0.5 font-mono text-[10px]
            text-slate-600
          "
          >
            {singleBranch.code}
          </span>
        )}
        {scope === 'pinned' && <Lock className="size-3 text-slate-400" />}
      </div>
    );
  }

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  // Persist to the session server-side, then reload: every staff page reads
  // the branch from its server context, so a full reload is the one way to
  // guarantee they all agree (DB5).
  const handleSelect = (id: string | null) => {
    fetch('/api/portal/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: id }),
    })
      .then((res) => {
        if (res.ok) {
          window.location.reload();
        }
      })
      .catch(() => {});
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="
        flex cursor-pointer items-center gap-1.5 rounded-xl border
        border-slate-200/80 bg-slate-50 px-2.5 py-1.5 text-xs font-bold
        text-[#16212B] outline-hidden transition-colors
        hover:bg-slate-100
      "
      >
        <Building2 className="size-3.5 text-[#2487B8]" />
        <span className="max-w-[120px] truncate">
          {selectedBranch ? selectedBranch.name : t('allBranches')}
        </span>
        <ChevronDown className="size-3 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="
          w-48 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-lg
        "
      >
        <DropdownMenuItem
          onClick={() => handleSelect(null)}
          className={`
            cursor-pointer rounded-lg px-3 py-2 font-bold
            ${!selectedBranchId
      ? `bg-sos-primary-soft text-sos-primary-active`
      : `
        text-[#16212B]
        hover:bg-slate-50
      `}
          `}
        >
          {t('allBranches')}
        </DropdownMenuItem>
        {branches.map(b => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => handleSelect(b.id)}
            className={`
              flex cursor-pointer items-center justify-between rounded-lg px-3
              py-2 font-medium
              ${selectedBranchId === b.id
            ? `bg-sos-primary-soft font-bold text-sos-primary-active`
            : `
              text-[#16212B]
              hover:bg-slate-50
            `}
            `}
          >
            <span className="truncate">{b.name}</span>
            <span className="
              rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]
              text-slate-500
            "
            >
              {b.code}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
