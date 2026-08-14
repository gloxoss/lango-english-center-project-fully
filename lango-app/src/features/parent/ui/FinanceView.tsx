'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ReceiptText, Wallet, AlertTriangle } from 'lucide-react';
import { ParentPageShell, type ParentPageShellContext } from './ParentPageShell';

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  netAmount: string | number;
  paidAmount: string | number;
  status: string;
  dueDate: string | null;
};

type Payment = {
  id: string;
  invoiceId: string | null;
  amount: string | number;
  paymentDate: string | null;
  paymentMethod: string | null;
};

type ChildFinance = {
  invoices: Invoice[];
  payments: Payment[];
  totalOutstanding: number;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  partial: 'Partiel',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Espèces',
  card: 'Carte',
  transfer: 'Virement',
  check: 'Chèque',
};

export function FinanceView() {
  return (
    <ParentPageShell
      title="Finance"
      subtitle="Factures, paiements et solde restant de votre enfant."
      icon={<Wallet className="w-6 h-6" />}
    >
      <FinanceContent />
    </ParentPageShell>
  );
}

function FinanceContent({ relationshipId, loading: shellLoading }: Partial<ParentPageShellContext>) {
  const [finance, setFinance] = useState<ChildFinance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (rid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guardian/me/children/${encodeURIComponent(rid)}/finance`);
      const json = await res.json();
      if (json.success) {
        setFinance(json.data as ChildFinance);
      } else {
        setError(json.error?.message ?? 'Erreur lors du chargement des finances.');
      }
    } catch {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (relationshipId) load(relationshipId);
  }, [relationshipId, load]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {(loading || shellLoading) && !finance ? (
        <div className="h-40 animate-pulse bg-slate-100 rounded-xl" />
      ) : finance ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="text-sm text-slate-500">Solde total restant</div>
              <div className="mt-1 text-3xl font-bold text-[#0066FF]">{finance.totalOutstanding} MAD</div>
            </div>
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="text-sm text-slate-500">Factures</div>
              <div className="mt-1 text-3xl font-bold text-slate-900">{finance.invoices.length}</div>
            </div>
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="text-sm text-slate-500">Paiements enregistrés</div>
              <div className="mt-1 text-3xl font-bold text-slate-900">{finance.payments.length}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-[#0066FF]" />
              <h2 className="font-semibold text-slate-900">Factures</h2>
            </div>
            {finance.invoices.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">Aucune facture pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-5 py-3 font-medium">N° facture</th>
                      <th className="px-5 py-3 font-medium">Statut</th>
                      <th className="px-5 py-3 font-medium text-right">Montant</th>
                      <th className="px-5 py-3 font-medium text-right">Payé</th>
                      <th className="px-5 py-3 font-medium text-right">Restant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {finance.invoices.map((inv) => {
                      const restant = Math.max(0, Number(inv.netAmount) - Number(inv.paidAmount));
                      return (
                        <tr key={inv.id}>
                          <td className="px-5 py-3 font-medium text-slate-800">{inv.invoiceNumber ?? '—'}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700'
                              : inv.status === 'overdue' ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                            }`}>
                              {STATUS_LABEL[inv.status] ?? inv.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">{Number(inv.netAmount)} MAD</td>
                          <td className="px-5 py-3 text-right">{Number(inv.paidAmount)} MAD</td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-900">{restant} MAD</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Paiements</h2>
            </div>
            {finance.payments.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">Aucun paiement enregistré.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Mode</th>
                      <th className="px-5 py-3 font-medium text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {finance.payments.map((pay) => (
                      <tr key={pay.id}>
                        <td className="px-5 py-3">{pay.paymentDate ? new Date(pay.paymentDate).toLocaleDateString('fr-FR') : '—'}</td>
                        <td className="px-5 py-3">{pay.paymentMethod ? (METHOD_LABEL[pay.paymentMethod] ?? pay.paymentMethod) : '—'}</td>
                        <td className="px-5 py-3 text-right font-medium">{Number(pay.amount)} MAD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
