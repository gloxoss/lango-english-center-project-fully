'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';

type OverdueInvoice = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  dueDate: string;
  netAmount: number;
  paidAmount: number;
  status: string;
};

type SendRecord = {
  id: string;
  invoiceNumber: string;
  studentName: string;
  recipientPhone: string;
  body: string;
  status: string;
  sentAt: string;
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-amber-100 text-amber-700',
  overdue: 'bg-rose-100 text-rose-600',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  partial: 'Partielle',
  overdue: 'En retard',
};

function mad(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`;
}

function formatDate(date: string): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function RemindersStatementsView() {
  const [overdue, setOverdue] = useState<OverdueInvoice[]>([]);
  const [sent, setSent] = useState<SendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/finance/reminders');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setOverdue((json?.data ?? []) as OverdueInvoice[]);
    } catch {
      setError('Impossible de charger les factures en retard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendReminder = useCallback(async (invoiceId: string, studentName: string) => {
    setSendingId(invoiceId);
    setFlash(null);
    try {
      const res = await fetch('/api/finance/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash(`Échec : ${json?.message ?? `HTTP ${res.status}`}`);
        return;
      }
      const sms = json.data;
      const inv = overdue.find((i) => i.id === invoiceId);
      setSent((prev) => [
        {
          id: sms?.id ?? `${Date.now()}`,
          invoiceNumber: inv?.invoiceNumber ?? invoiceId,
          studentName,
          recipientPhone: sms?.recipientPhone ?? '—',
          body: sms?.body ?? '',
          status: sms?.status ?? 'sent',
          sentAt: sms?.sentAt ?? new Date().toISOString(),
        },
        ...prev,
      ]);
      setFlash(`Rappel envoyé pour ${studentName}.`);
    } catch {
      setFlash('Erreur réseau lors de l’envoi du rappel.');
    } finally {
      setSendingId(null);
    }
  }, [overdue]);

  const totalOutstanding = overdue.reduce((sum, i) => sum + (Number(i.netAmount) - Number(i.paidAmount)), 0);

  if (loading) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="h-40 animate-pulse bg-slate-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reçus, rappels &amp; relevés</h1>
          <p className="text-sm text-slate-500">Factures en retard et envoi de rappels de paiement aux familles.</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          aria-label="Actualiser"
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {flash && (
        <div className="p-4 bg-[#DDF5EC] border border-[#17A673]/30 rounded-lg text-[#17A673] text-sm flex items-center gap-2" role="status">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{flash}</span>
        </div>
      )}

      {/* KPI band */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Factures en retard</p>
            <p className="text-xl font-extrabold text-slate-900">{overdue.length}</p>
            <p className="text-[11px] text-slate-400">échéance dépassée</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Solde total impayé</p>
            <p className="text-xl font-extrabold text-slate-900">{mad(totalOutstanding)}</p>
            <p className="text-[11px] text-slate-400">toutes factures en retard</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] text-[#17A673] flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Rappels envoyés</p>
            <p className="text-xl font-extrabold text-slate-900">{sent.length}</p>
            <p className="text-[11px] text-slate-400">cette session</p>
          </div>
        </div>
      </div>

      {/* Overdue invoices */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-rose-600" />
          <h2 className="font-semibold text-slate-900">Factures en retard de paiement</h2>
        </div>
        {overdue.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">Aucune facture en retard. Toutes les échéances sont à jour.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3 font-semibold">N° facture</th>
                  <th className="px-5 py-3 font-semibold">Élève</th>
                  <th className="px-5 py-3 font-semibold">Échéance</th>
                  <th className="px-5 py-3 text-right font-semibold">Montant</th>
                  <th className="px-5 py-3 text-right font-semibold">Payé</th>
                  <th className="px-5 py-3 text-right font-semibold">Solde</th>
                  <th className="px-5 py-3 text-right font-semibold">Statut</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdue.map((inv) => {
                  const balance = Number(inv.netAmount) - Number(inv.paidAmount);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-mono text-xs font-bold text-[#0066FF]">{inv.invoiceNumber}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">{inv.studentName}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{formatDate(inv.dueDate)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-800">{mad(Number(inv.netAmount))}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{mad(Number(inv.paidAmount))}</td>
                      <td className="px-5 py-3 text-right font-bold text-rose-600">{mad(balance)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[inv.status] ?? inv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          disabled={sendingId === inv.id}
                          onClick={() => sendReminder(inv.id, inv.studentName)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-[#0052CC] disabled:opacity-60 disabled:cursor-not-allowed transition"
                        >
                          {sendingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Envoyer un rappel
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send log */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#0066FF]" />
          <h2 className="font-semibold text-slate-900">Journal des rappels envoyés</h2>
        </div>
        {sent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">Aucun rappel envoyé lors de cette session.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3 font-semibold">Date / heure</th>
                  <th className="px-5 py-3 font-semibold">Élève</th>
                  <th className="px-5 py-3 font-semibold">N° facture</th>
                  <th className="px-5 py-3 font-semibold">Destinataire</th>
                  <th className="px-5 py-3 font-semibold">Message</th>
                  <th className="px-5 py-3 text-right font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sent.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 text-xs text-slate-500">{new Date(s.sentAt).toLocaleString('fr-FR')}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{s.studentName}</td>
                    <td className="px-5 py-3 font-mono text-xs font-bold text-[#0066FF]">{s.invoiceNumber}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{s.recipientPhone}</td>
                    <td className="px-5 py-3 text-xs text-slate-600 max-w-md truncate" title={s.body}>{s.body}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DDF5EC] text-[#17A673]">Envoyé</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" /> Rappels envoyés en SMS simulé via le module Finance réel.
      </p>
    </div>
  );
}
