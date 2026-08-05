'use client';

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface PendingExpenseApproval {
  id: string;
  amount: number;
  category: string;
  expenseDate: string;
  description: string;
  createdAt: string;
  recordedByName: string | null;
}

export default function ApprovalsPage() {
  const [pendingExpenses, setPendingExpenses] = useState<PendingExpenseApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accountant/me/approvals');
      const json = await res.json();
      if (json.success) {
        setPendingExpenses(json.data.pendingExpenses);
      } else {
        setError(json.error?.message || 'Erreur lors du chargement des approbations.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/accountant/me/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          type: 'expense',
          action,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`Demande ${action === 'approve' ? 'approuvée' : 'rejetée'} avec succès.`);
        fetchApprovals();
      } else {
        setError(json.error?.message || 'Impossible de traiter l\'approbation.');
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
            Centre d'Approbation Financière
          </h1>
          <p className="text-sm text-slate-500">
            Validation maker-checker des demandes d'avoirs, remises exceptionnelles et dépenses.
          </p>
        </div>
        <button
          onClick={fetchApprovals}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
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

      {/* Pending Items Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-200 bg-slate-50 p-4 font-bold text-slate-800 text-sm flex items-center justify-between">
          <span>Demandes en Attente de Validation ({pendingExpenses.length})</span>
          <ShieldAlert className="size-4 text-amber-600" />
        </div>

        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/50 font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Initié Par</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">Chargement des demandes...</td>
              </tr>
            ) : pendingExpenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">Aucune demande en attente d'approbation.</td>
              </tr>
            ) : (
              pendingExpenses.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-bold text-slate-900">{item.expenseDate}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-800 uppercase">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 font-extrabold text-slate-900">{item.amount} MAD</td>
                  <td className="px-4 py-3 text-slate-500">{item.recordedByName || 'Système'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleAction(item.id, 'approve')}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="size-3" />
                      Approuver
                    </button>
                    <button
                      onClick={() => handleAction(item.id, 'reject')}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1 rounded-md bg-red-100 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-200"
                    >
                      <XCircle className="size-3" />
                      Rejeter
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
