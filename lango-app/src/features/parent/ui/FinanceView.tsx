'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '@/libs/finance/format-money';
import { ReceiptText, Wallet, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
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

export function FinanceView() {
  const tParent = useTranslations('Parent');
  return (
    <ParentPageShell
      title={tParent('financeTitle')}
      subtitle={tParent('financeSubtitle')}
      icon={<Wallet className="w-6 h-6" />}
    >
      <FinanceContent />
    </ParentPageShell>
  );
}

function FinanceContent({ relationshipId, loading: shellLoading }: Partial<ParentPageShellContext>) {
  const tParent = useTranslations('Parent');
  const [finance, setFinance] = useState<ChildFinance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStatusLabel = (status: string) => {
    const key = status.toLowerCase();
    switch (key) {
      case 'pending': return tParent('pending');
      case 'partial': return tParent('partial');
      case 'paid': return tParent('paid');
      case 'overdue': return tParent('overdue');
      case 'cancelled': return tParent('cancelled');
      default: return status;
    }
  };

  const getMethodLabel = (method: string) => {
    const key = method.toLowerCase();
    switch (key) {
      case 'cash': return tParent('cash');
      case 'card': return tParent('card');
      case 'transfer': return tParent('transfer');
      case 'check': return tParent('check');
      default: return method;
    }
  };

  const load = useCallback(async (rid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guardian/me/children/${encodeURIComponent(rid)}/finance`);
      const json = await res.json();
      if (json.success) {
        setFinance(json.data as ChildFinance);
      } else {
        setError(json.error?.message ?? tParent('errorLoadFinance'));
      }
    } catch {
      setError(tParent('errorConnect'));
    } finally {
      setLoading(false);
    }
  }, [tParent]);

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
              <div className="text-sm text-slate-500">{tParent('totalOutstanding')}</div>
              <div className="mt-1 text-3xl font-bold text-[#0066FF]">{formatMoney(finance.totalOutstanding)}</div>
            </div>
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="text-sm text-slate-500">{tParent('invoicesCount')}</div>
              <div className="mt-1 text-3xl font-bold text-slate-900">{finance.invoices.length}</div>
            </div>
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="text-sm text-slate-500">{tParent('paymentsCount')}</div>
              <div className="mt-1 text-3xl font-bold text-slate-900">{finance.payments.length}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-[#0066FF]" />
              <h2 className="font-semibold text-slate-900">{tParent('invoicesTitle')}</h2>
            </div>
            {finance.invoices.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">{tParent('noInvoices')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-start">
                    <tr>
                      <th className="px-5 py-3 font-medium">{tParent('invoiceNumber')}</th>
                      <th className="px-5 py-3 font-medium">{tParent('status')}</th>
                      <th className="px-5 py-3 font-medium text-end">{tParent('amount')}</th>
                      <th className="px-5 py-3 font-medium text-end">{tParent('paid')}</th>
                      <th className="px-5 py-3 font-medium text-end">{tParent('remaining')}</th>
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
                              {getStatusLabel(inv.status)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-end">{formatMoney(inv.netAmount)}</td>
                          <td className="px-5 py-3 text-end">{formatMoney(inv.paidAmount)}</td>
                          <td className="px-5 py-3 text-end font-semibold text-slate-900">{formatMoney(restant)}</td>
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
              <h2 className="font-semibold text-slate-900">{tParent('paymentsTitle')}</h2>
            </div>
            {finance.payments.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">{tParent('noPayments')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-start">
                    <tr>
                      <th className="px-5 py-3 font-medium">{tParent('date')}</th>
                      <th className="px-5 py-3 font-medium">{tParent('paymentMethod')}</th>
                      <th className="px-5 py-3 font-medium text-end">{tParent('amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {finance.payments.map((pay) => (
                      <tr key={pay.id}>
                        <td className="px-5 py-3">{pay.paymentDate ? new Date(pay.paymentDate).toLocaleDateString() : '—'}</td>
                        <td className="px-5 py-3">{pay.paymentMethod ? getMethodLabel(pay.paymentMethod) : '—'}</td>
                        <td className="px-5 py-3 text-end font-medium">{formatMoney(pay.amount)}</td>
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
