'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, CheckCircle2, XCircle } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type CreditNote = {
  id: string;
  studentId: string;
  studentName: string;
  invoiceId: string | null;
  creditNoteNumber: string;
  amount: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  rejectionReason: string | null;
};

function statusBadge(status: CreditNote['status']) {
  if (status === 'approved') {
    return <Badge className="bg-[#DDF5EC] text-[#17A673] text-[10px] border-none font-bold">Approuvée</Badge>;
  }
  if (status === 'rejected') {
    return <Badge className="bg-rose-100 text-rose-600 text-[10px] border-none font-bold">Rejetée</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-700 text-[10px] border-none font-bold">En attente</Badge>;
}

export function CreditNotesView() {
  const { can } = usePermissions();
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', invoiceId: '', amount: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/finance/credit-notes')
      .then(res => (res.ok ? res.json() : null))
      .then(json => json?.success && setNotes(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.studentId || !form.amount || !form.reason) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: form.studentId,
          invoiceId: form.invoiceId || undefined,
          amount: form.amount,
          reason: form.reason,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || 'Échec de la création.');
        return;
      }
      setShowForm(false);
      setForm({ studentId: '', invoiceId: '', amount: '', reason: '' });
      load();
    } catch {
      setError('Connexion impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDecide = async (id: string, decision: 'approved' | 'rejected') => {
    const rejectionReason = decision === 'rejected' ? window.prompt('Motif du rejet :') : undefined;
    if (decision === 'rejected' && !rejectionReason) {
      return;
    }
    setDecidingId(id);
    try {
      await fetch('/api/finance/credit-notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision, rejectionReason }),
      });
      load();
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Notes de crédit</h1>
          <p className="text-xs text-slate-500 mt-1">{notes.length} note(s) de crédit réelle(s) pour cet établissement.</p>
        </div>
        {can('finance.manage') && (
          <Button size="sm" onClick={() => setShowForm(v => !v)} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nouvelle note de crédit
          </Button>
        )}
      </div>

      {can('finance.manage') && showForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">ID de l&apos;élève</label>
              <Input value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">ID facture (optionnel)</label>
              <Input value={form.invoiceId} onChange={e => setForm({ ...form, invoiceId: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Montant (MAD)</label>
              <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Motif</label>
              <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="h-9 rounded-xl" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={handleCreate} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              {saving ? 'Enregistrement...' : 'Créer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-9 rounded-xl text-xs font-bold">
              Annuler
            </Button>
          </div>
        </Card>
      )}

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
            <tr>
              <th className="py-3.5 px-4">N°</th>
              <th className="py-3.5 px-4">Élève</th>
              <th className="py-3.5 px-4">Motif</th>
              <th className="py-3.5 px-4 text-right">Montant</th>
              <th className="py-3.5 px-4 text-center">Statut</th>
              <th className="py-3.5 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && notes.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">Aucune note de crédit.</td></tr>
            )}
            {notes.map(n => (
              <tr key={n.id} className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3.5 px-4 font-mono text-[#2487B8] font-bold">{n.creditNoteNumber}</td>
                <td className="py-3.5 px-4 font-bold text-[#16212B]">{n.studentName}</td>
                <td className="py-3.5 px-4 text-slate-500">{n.reason}</td>
                <td className="py-3.5 px-4 text-right font-extrabold text-[#16212B]">{Number(n.amount).toLocaleString('fr-FR')} MAD</td>
                <td className="py-3.5 px-4 text-center">{statusBadge(n.status)}</td>
                <td className="py-3.5 px-4">
                  {n.status === 'pending' && can('finance.approve') && (
                    <div className="flex items-center justify-end gap-1">
                      <button disabled={decidingId === n.id} onClick={() => handleDecide(n.id, 'approved')} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#DDF5EC] hover:text-[#17A673]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button disabled={decidingId === n.id} onClick={() => handleDecide(n.id, 'rejected')} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {n.status === 'pending' && !can('finance.approve') && (
                    <span className="text-[10px] font-semibold text-slate-400">En attente d&apos;un administrateur</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
