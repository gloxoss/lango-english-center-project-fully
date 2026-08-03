'use client';

import { DollarSign, CheckCircle2, Printer, Search } from 'lucide-react';
import React, { useState } from 'react';

export function CashierPaymentModal() {
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('1500.00');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('processing');
    setTimeout(() => {
      setStatus('success');
    }, 1000);
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-400" />
          <div>
            <h2 className="text-lg font-bold text-white">Guichet Caisse — Encaissement Rapide</h2>
            <p className="text-xs text-slate-400">Encaissement des frais de scolarité avec reçu instantané</p>
          </div>
        </div>
      </div>

      {status === 'success' ? (
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">Paiement Réglé avec Succès !</h3>
          <p className="text-xs text-slate-300">Reçu N° REC-2026-0892 généré et imputé au compte de l élève.</p>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all inline-flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Imprimer le Reçu PDF
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Recherche Élève / Matricule</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Ex: Youssef El Amrani ou 2026-0042"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Montant Encaissé (DH)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Mode de Règlement</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="cash">Espèces (Caisse)</option>
                <option value="card">Carte Bancaire (TPE)</option>
                <option value="transfer">Virement Bancaire</option>
                <option value="check">Chèque</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={status === 'processing'}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/20"
          >
            {status === 'processing' ? 'Validation de l encaissement...' : 'Valider l Encaissement & Générer le Reçu'}
          </button>
        </form>
      )}
    </div>
  );
}
