import React from 'react';
import { CashierPaymentModal } from '@/components/accountant/CashierPaymentModal';

export default function AccountantPortalPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900/40 via-teal-900/30 to-slate-900 p-6 rounded-2xl border border-emerald-500/20 shadow-xl">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Espace Comptable / Caisse</span>
          <h1 className="text-2xl font-bold text-white mt-1">Gestion Financière & Guichet Caisse</h1>
          <p className="text-slate-400 text-sm mt-1">Encaissements rapides, suivi des créances élèves et rapprochement bancaire.</p>
        </div>
      </div>

      <CashierPaymentModal />
    </div>
  );
}
