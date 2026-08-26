'use client';

import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Filter,
  PlusCircle,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ExpenseItem {
  id: string;
  amount: number;
  category: string;
  expenseDate: string;
  description: string;
  receiptUrl: string | null;
  createdAt: string;
  recordedByName: string | null;
}

export default function OfficeAccountingPage() {
  const [data, setData] = useState<{ summary: { totalAmount: number; count: number }; expenses: ExpenseItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New expense form modal
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'salary' | 'rent' | 'utilities' | 'supplies' | 'marketing' | 'other'>('supplies');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const fetchExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/expenses?pageSize=200');
      const json = await res.json();
      if (json.success) {
        const rows = (json.data || []).map((row: any) => ({ ...row, amount: Number(row.amount), recordedByName: null }));
        setData({ summary: { totalAmount: rows.reduce((sum: number, row: ExpenseItem) => sum + row.amount, 0), count: rows.length }, expenses: rows });
      } else {
        setError(json.error?.message || 'Erreur lors du chargement des dépenses.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      let receiptUrl: string | undefined;
      if (receiptFile) {
        const upload = new FormData();
        upload.append('file', receiptFile);
        const uploadRes = await fetch('/api/finance/expenses/receipt', { method: 'POST', body: upload });
        const uploadJson = await uploadRes.json();
        if (!uploadJson.success) throw new Error(uploadJson.error?.message || 'Échec du téléversement du justificatif.');
        receiptUrl = uploadJson.data.url;
      }
      const res = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          category,
          expenseDate,
          description,
          receiptUrl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(json.glPosted ? 'Dépense enregistrée et comptabilisée dans le grand livre.' : 'Dépense enregistrée; la liaison GL sera créée dès que les comptes par défaut seront configurés.');
        setShowModal(false);
        setAmount('');
        setDescription('');
        setReceiptFile(null);
        fetchExpenses();
      } else {
        setError(json.error?.message || 'Impossible d\'enregistrer la dépense.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dépenses & Grand Livre
          </h1>
          <p className="text-sm text-slate-500">
            Chaque dépense alimente le registre financier officiel et tente une comptabilisation automatique en partie double.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchExpenses}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0052CC]"
          >
            <PlusCircle className="size-4" />
            Saisir une Dépense
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Dépenses Enregistrées</span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            {loading ? '...' : `${(data?.summary.totalAmount || 0).toLocaleString('fr-FR')} MAD`}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Nombre d'Écritures</span>
          <div className="mt-2 text-2xl font-extrabold text-[#0066FF]">
            {loading ? '...' : (data?.summary.count || 0)}
          </div>
        </div>
      </div>

      {/* Expense Journal Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Enregistré Par</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">Chargement des dépenses...</td>
              </tr>
            ) : data?.expenses.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">Aucune dépense enregistrée.</td>
              </tr>
            ) : (
              data?.expenses.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-bold text-slate-900">{item.expenseDate}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 uppercase">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 font-extrabold text-red-700">-{item.amount} MAD</td>
                  <td className="px-4 py-3 text-slate-500">{item.recordedByName || 'Système'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Nouvelle Dépense Bureau</h3>
            <p className="mt-1 text-xs text-slate-500">Saisissez les détails de l'écriture comptable.</p>

            <form onSubmit={handleCreateExpense} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">Catégorie</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                >
                  <option value="supplies">Fournitures & Matériel</option>
                  <option value="utilities">Eau, Électricité & Telecom</option>
                  <option value="rent">Loyer & Charges Locatives</option>
                  <option value="salary">Salaires & Vacations</option>
                  <option value="marketing">Marketing & Communication</option>
                  <option value="other">Autre Dépense</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Montant (MAD)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-semibold text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Date d'opération</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={e => setExpenseDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Description / Libellé</label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Détail du paiement ou pièce justificative..."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Justificatif (PDF, JPG ou PNG)</label>
                <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setReceiptFile(e.target.files?.[0] || null)} className="mt-1 w-full text-xs text-slate-600" />
              </div>

              <p className="text-[11px] text-slate-500">La dépense sera transmise automatiquement au grand livre via les comptes comptables par défaut.</p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-[#0066FF] px-5 py-2 text-xs font-bold text-white hover:bg-[#0052CC]"
                >
                  {actionLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
