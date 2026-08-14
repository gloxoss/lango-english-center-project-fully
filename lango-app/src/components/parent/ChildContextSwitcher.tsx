'use client';

import { Users, ChevronDown, Check, UserPlus } from 'lucide-react';
import React, { useState } from 'react';

export type LinkedChildOption = {
  relationshipId: string;
  name: string;
  className: string | null;
  level: string | null;
  matricule: string | null;
  isPrimaryContact: boolean;
};

type ChildContextSwitcherProps = {
  children: LinkedChildOption[];
  activeRelationshipId: string | null;
  onChange: (relationshipId: string) => void;
};

// Server-data-driven child switcher. The selection is UI convenience only —
// every data request is relationship-scoped and reauthorized server-side, so
// the client-held id is never trusted as authorization on its own.
export function ChildContextSwitcher({ children, activeRelationshipId, onChange }: ChildContextSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const active = children.find((c) => c.relationshipId === activeRelationshipId) ?? children[0];

  if (children.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl bg-slate-50">
        <UserPlus className="w-4 h-4 text-slate-400" />
        <span>Aucun enfant lié à votre compte.</span>
      </div>
    );
  }

  const initials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 hover:border-[#0066FF]/50 rounded-xl shadow-sm transition-all text-left"
      >
        <div className="w-8 h-8 rounded-full bg-[#0066FF]/10 border border-[#0066FF]/30 flex items-center justify-center text-[#0066FF] font-bold text-xs">
          {active ? initials(active.name) : '?'}
        </div>
        <div>
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <span>Élève sélectionné</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>
          <div className="text-sm font-bold text-slate-900 leading-tight">{active?.name}</div>
          <div className="text-[11px] text-[#0066FF]">{active?.className ?? active?.level ?? '—'}</div>
        </div>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Enfants scolarisés"
          className="absolute start-0 lg:end-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 space-y-1"
        >
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 border-b border-slate-100 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#0066FF]" />
            <span>Enfants scolarisés ({children.length})</span>
          </div>
          {children.map((child) => {
            const selected = child.relationshipId === (activeRelationshipId ?? children[0]?.relationshipId);
            return (
              <button
                key={child.relationshipId}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(child.relationshipId);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                  selected ? 'bg-[#0066FF]/10 text-slate-900 border border-[#0066FF]/30' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-[10px]">
                    {initials(child.name)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{child.name}</div>
                    <div className="text-xs text-slate-500">
                      {child.className ?? child.level ?? '—'}
                      {child.isPrimaryContact ? ' · Principal' : ''}
                    </div>
                  </div>
                </div>
                {selected && <Check className="w-4 h-4 text-[#0066FF]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
