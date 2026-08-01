'use client';

import { Building2, ChevronDown } from 'lucide-react';
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

export function HeaderCampusSwitcher() {
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/settings/branches')
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (json?.success && Array.isArray(json.data)) {
          setBranches(json.data);
          const saved = localStorage.getItem('lango_active_branch_id');
          if (saved && json.data.some((b: BranchItem) => b.id === saved)) {
            setSelectedBranchId(saved);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return null;
  }

  // If no branches or 1 branch, render static branch indicator pill so user sees active campus context
  if (branches.length <= 1) {
    const singleBranch = branches[0];
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50 text-xs font-bold text-[#16212B]">
        <Building2 className="w-3.5 h-3.5 text-[#2487B8]" />
        <span className="truncate max-w-[120px]">
          {singleBranch ? singleBranch.name : 'Campus Principal'}
        </span>
        {singleBranch?.code && (
          <span className="text-[10px] bg-slate-200/60 px-1.5 py-0.5 rounded text-slate-600 font-mono">
            {singleBranch.code}
          </span>
        )}
      </div>
    );
  }

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const handleSelect = (id: string | null) => {
    if (id) {
      localStorage.setItem('lango_active_branch_id', id);
    } else {
      localStorage.removeItem('lango_active_branch_id');
    }
    setSelectedBranchId(id);
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-[#16212B] transition-colors outline-hidden cursor-pointer">
        <Building2 className="w-3.5 h-3.5 text-[#2487B8]" />
        <span className="truncate max-w-[120px]">
          {selectedBranch ? selectedBranch.name : 'Toutes les succursales'}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 bg-white border border-slate-200 rounded-xl p-1 shadow-lg text-xs">
        <DropdownMenuItem
          onClick={() => handleSelect(null)}
          className={`px-3 py-2 rounded-lg cursor-pointer font-bold ${!selectedBranchId ? 'bg-[#DCEBF4] text-[#1B6C93]' : 'text-[#16212B] hover:bg-slate-50'}`}
        >
          Toutes les succursales
        </DropdownMenuItem>
        {branches.map(b => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => handleSelect(b.id)}
            className={`px-3 py-2 rounded-lg cursor-pointer font-medium flex items-center justify-between ${selectedBranchId === b.id ? 'bg-[#DCEBF4] text-[#1B6C93] font-bold' : 'text-[#16212B] hover:bg-slate-50'}`}
          >
            <span className="truncate">{b.name}</span>
            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">
              {b.code}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
