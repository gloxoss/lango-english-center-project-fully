'use client';

import { CreditCard, Download, FileText, CheckCircle2 } from 'lucide-react';
import React from 'react';

export function ParentInvoiceBreakdown() {
  return (
    <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Situation Financière & Frais de Scolarité</h2>
        </div>
        <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Compte à jour
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
          <div className="text-xs text-slate-400 font-medium">Montant Total Facturé</div>
          <div className="text-xl font-bold text-white mt-1">4 500,00 DH</div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
          <div className="text-xs text-slate-400 font-medium">Montant Réglé</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">4 500,00 DH</div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
          <div className="text-xs text-slate-400 font-medium">Reste à Payer</div>
          <div className="text-xl font-bold text-slate-400 mt-1">0,00 DH</div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Historique des Reçus & Factures</h3>
        <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3.5 bg-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-indigo-400" />
              <div>
                <div className="text-sm font-semibold text-white">Facture T1-2026-0012</div>
                <div className="text-xs text-slate-400">Frais de Scolarité 1er Trimestre 2025/2026</div>
              </div>
            </div>
            <button
              type="button"
              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-all flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              Reçu PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
