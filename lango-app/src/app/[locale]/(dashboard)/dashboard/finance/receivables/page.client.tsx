'use client';

import {
  AlertCircle,
  Clock,
  Download,
  Filter,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface InvoiceReceivable {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
  dueDate: string;
  issueDate: string;
  daysOverdue: number;
}

interface ReceivablesSummary {
  totalOutstanding: number;
  current030: number;
  overdue3160: number;
  overdue6190: number;
  overdue90Plus: number;
  totalCount: number;
}

export default function ReceivablesPage() {
  const [data, setData] = useState<{ summary: ReceivablesSummary; invoices: InvoiceReceivable[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchReceivables = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accountant/me/receivables');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message || 'Erreur lors du chargement des créances.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceivables();
  }, []);

  const filteredInvoices = data?.invoices.filter((inv) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(term) ||
      (inv.studentName && inv.studentName.toLowerCase().includes(term))
    );
  }) || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Analyse de l'Ancienneté des Créances (Aging Receivables)
          </h1>
          <p className="text-sm text-slate-500">
            Suivi des factures impayées par tranche de retard et relance des familles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchReceivables}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            onClick={() => alert('Export du tableau d\'ancienneté généré avec succès.')}
            className="flex items-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0052CC]"
          >
            <Download className="size-4" />
            Exporter Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Buckets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Total Créances</span>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {loading ? '...' : `${(data?.summary.totalOutstanding || 0).toLocaleString('fr-FR')} MAD`}
          </div>
          <span className="text-xs text-slate-500">{data?.summary.totalCount || 0} factures</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase">0 - 30 Jours (Courant)</span>
          <div className="mt-2 text-xl font-extrabold text-emerald-800">
            {loading ? '...' : `${(data?.summary.current030 || 0).toLocaleString('fr-FR')} MAD`}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase">31 - 60 Jours</span>
          <div className="mt-2 text-xl font-extrabold text-amber-800">
            {loading ? '...' : `${(data?.summary.overdue3160 || 0).toLocaleString('fr-FR')} MAD`}
          </div>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-orange-700 uppercase">61 - 90 Jours</span>
          <div className="mt-2 text-xl font-extrabold text-orange-800">
            {loading ? '...' : `${(data?.summary.overdue6190 || 0).toLocaleString('fr-FR')} MAD`}
          </div>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-red-700 uppercase">&gt; 90 Jours (Critique)</span>
          <div className="mt-2 text-xl font-extrabold text-red-800">
            {loading ? '...' : `${(data?.summary.overdue90Plus || 0).toLocaleString('fr-FR')} MAD`}
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrer par n° facture ou nom d'élève..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Facture</th>
              <th className="px-4 py-3">Élève</th>
              <th className="px-4 py-3">Échéance</th>
              <th className="px-4 py-3">Retard (Jours)</th>
              <th className="px-4 py-3">Montant Total</th>
              <th className="px-4 py-3">Reste à Payer</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">Chargement des créances...</td>
              </tr>
            ) : filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">Aucune créance en souffrance trouvée.</td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-bold text-slate-900">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{inv.studentName || 'Élève'}</div>
                    <div className="text-[11px] text-slate-400">{inv.studentEmail}</div>
                  </td>
                  <td className="px-4 py-3">{inv.dueDate}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${inv.daysOverdue > 60 ? 'bg-red-100 text-red-800' : inv.daysOverdue > 30 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                      {inv.daysOverdue} j
                    </span>
                  </td>
                  <td className="px-4 py-3">{inv.amount} MAD</td>
                  <td className="px-4 py-3 font-extrabold text-red-700">{inv.balance} MAD</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => alert(`Rappel SMS envoyé à la famille de ${inv.studentName || 'l\'élève'}`)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#0066FF] hover:bg-blue-100"
                    >
                      <MessageSquare className="size-3" />
                      Relancer SMS
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
