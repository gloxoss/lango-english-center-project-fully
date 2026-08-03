import React from 'react';
import { ChildContextSwitcher } from '@/components/parent/ChildContextSwitcher';
import { ParentInvoiceBreakdown } from '@/components/parent/ParentInvoiceBreakdown';

export default function ParentPortalPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900 p-6 rounded-2xl border border-purple-500/20 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Espace Parent / Tuteur</span>
            <h1 className="text-2xl font-bold text-white mt-1">Suivi Scolaire & Financier du Foyer</h1>
            <p className="text-slate-400 text-sm mt-1">Consultez les résultats, l assiduité et le règlement des frais de scolarité.</p>
          </div>
          <ChildContextSwitcher />
        </div>
      </div>

      <ParentInvoiceBreakdown />
    </div>
  );
}
