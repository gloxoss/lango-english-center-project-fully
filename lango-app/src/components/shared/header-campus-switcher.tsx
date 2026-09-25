'use client';

import { Building2, ChevronDown, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type BranchItem = {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
};

type BranchScope = 'all' | 'pinned';

// THE authoritative global branch context. Every other surface (dashboard
// summary, search, widgets) derives its branch from the value this switcher
// persists; the dashboard header renders no selector of its own.
export function HeaderCampusSwitcher() {
  const t = useTranslations('Common');
  const th = useTranslations('DashboardHome');
  const pathname = usePathname();
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [scope, setScope] = useState<BranchScope>('all');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/settings/branches')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && Array.isArray(json.data)) {
          setBranches(json.data);
          const serverScope: BranchScope = json.meta?.branchScope === 'pinned' ? 'pinned' : 'all';
          setScope(serverScope);
          const pinned: string | null = json.meta?.pinnedBranchId ?? null;
          const saved = localStorage.getItem('schoolos_active_branch_id');
          if (serverScope === 'pinned') {
            // Branch-pinned principal: confined server-side; mirror the pin.
            setSelectedBranchId(pinned);
          } else if (saved) {
            if (json.data.some((b: BranchItem) => b.id === saved)) {
              setSelectedBranchId(saved);
            } else {
              localStorage.removeItem('schoolos_active_branch_id');
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return null;
  }

  // Pinned scope or single-branch tenant: static indicator pill, no menu.
  if (scope === 'pinned' || branches.length <= 1) {
    const singleBranch = scope === 'pinned'
      ? branches.find(b => b.id === selectedBranchId)
      : branches[0];
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

  const handleSelect = (id: string | null) => {
    if (id) {
      localStorage.setItem('schoolos_active_branch_id', id);
    } else {
      localStorage.removeItem('schoolos_active_branch_id');
    }
    setSelectedBranchId(id);
    window.dispatchEvent(new CustomEvent('schoolos:branch-changed', { detail: { branchId: id } }));
    // Dashboard pages listen for the event and refetch reactively; other
    // surfaces read the branch on load, so they need one refresh.
    if (!pathname || !/^\/[a-z]{2}\/dashboard/.test(pathname)) {
      window.location.reload();
    }
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
