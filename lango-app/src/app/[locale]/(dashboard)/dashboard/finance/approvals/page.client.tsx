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
import { usePermissions } from '@/hooks/use-permissions';

type ItemType = 'expense' | 'credit_note' | 'refund';

interface PendingItem {
  id: string;
  type: ItemType;
  date: string;
  description: string;
  amount: number;
  initiatedBy: string;
}

const TYPE_LABEL: Record<ItemType, string> = {
  expense: 'Dépense',
  credit_note: 'Note de crédit',
  refund: 'Remboursement',
};

const TYPE_BADGE: Record<ItemType, string> = {
  expense: 'bg-purple-100 text-purple-800',
  credit_note: 'bg-blue-100 text-blue-800',
  refund: 'bg-amber-100 text-amber-800',
};

export default function ApprovalsPage() {
  const { can } = usePermissions();
  const [items, setItems] = useState<PendingItem[]>([]);
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
        const expenseItems: PendingItem[] = json.data.pendingExpenses.map((e: any) => ({
          id: e.id, type: 'expense' as const, date: e.expenseDate, description: `${e.category} — ${e.description}`, amount: Number(e.amount), initiatedBy: e.recordedByName || 'Système',
        }));
        const creditNoteItems: PendingItem[] = json.data.pendingCreditNotes.map((c: any) => ({
          id: c.id, type: 'credit_note' as const, date: c.createdAt, description: `${c.creditNoteNumber} — ${c.reason}`, amount: Number(c.amount), initiatedBy: c.studentName || '—',
        }));
        const refundItems: PendingItem[] = json.data.pendingRefunds.map((r: any) => ({
          id: r.id, type: 'refund' as const, date: r.createdAt, description: `${r.refundNumber} — ${r.reason}`, amount: Number(r.amount), initiatedBy: r.studentName || '—',
        }));
        setItems([...expenseItems, ...creditNoteItems, ...refundItems].sort((a, b) => b.date.localeCompare(a.date)));
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

  const handleAction = async (id: string, type: ItemType, action: 'approve' | 'reject') => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/accountant/me/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          type,
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
          <span>Demandes en Attente de Validation ({items.length})</span>
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
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">Aucune demande en attente d'approbation.</td>
              </tr>
            ) : (
              items.map(item => (
                <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-bold text-slate-900">{item.date.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${TYPE_BADGE[item.type]}`}>
                      {TYPE_LABEL[item.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 font-extrabold text-slate-900">{item.amount} MAD</td>
                  <td className="px-4 py-3 text-slate-500">{item.initiatedBy}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {can('finance.approve')
                      ? (
                        <>
                          <button
                            onClick={() => handleAction(item.id, item.type, 'approve')}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="size-3" />
                            Approuver
                          </button>
                          <button
                            onClick={() => handleAction(item.id, item.type, 'reject')}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1 rounded-md bg-red-100 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-200"
                          >
                            <XCircle className="size-3" />
                            Rejeter
                          </button>
                        </>
                        )
                      : (
                        <span className="text-[11px] font-semibold text-slate-400">En attente d&apos;un administrateur</span>
                        )}
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
