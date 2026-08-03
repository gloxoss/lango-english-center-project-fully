'use client';

import { Users, ChevronDown, Check } from 'lucide-react';
import React, { useState } from 'react';

interface LinkedChild {
  id: string;
  name: string;
  className: string;
  matricule: string;
  avatarUrl?: string;
}

export function ChildContextSwitcher() {
  const [children] = useState<LinkedChild[]>([
    { id: 'usr_student_1', name: 'Youssef El Amrani', className: 'CE1 — Groupe A', matricule: '2026-0042' },
    { id: 'usr_student_2', name: 'Amin El Amrani', className: 'CM2 — Groupe B', matricule: '2026-0098' },
  ]);

  const [activeChildId, setActiveChildId] = useState<string>('usr_student_1');
  const [isOpen, setIsOpen] = useState(false);

  const activeChild = children.find(c => c.id === activeChildId) || children[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-xl transition-all shadow-md text-left"
      >
        <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
          {activeChild?.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <span>Élève sélectionné</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>
          <div className="text-sm font-bold text-white leading-tight">{activeChild?.name}</div>
          <div className="text-[11px] text-indigo-400">{activeChild?.className}</div>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-2 space-y-1">
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 border-b border-slate-800 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Enfants scolarisés ({children.length})</span>
          </div>
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => {
                setActiveChildId(child.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                child.id === activeChildId
                  ? 'bg-indigo-600/20 text-white border border-indigo-500/30'
                  : 'hover:bg-slate-800/60 text-slate-300'
              }`}
            >
              <div>
                <div className="text-sm font-semibold">{child.name}</div>
                <div className="text-xs text-slate-400">{child.className}</div>
              </div>
              {child.id === activeChildId && <Check className="w-4 h-4 text-indigo-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
