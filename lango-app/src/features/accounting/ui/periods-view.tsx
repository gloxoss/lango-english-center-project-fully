'use client';

import { AlertCircle, CheckCircle2, Lock, PlusCircle, RefreshCw, Unlock, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Period = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  closedById: string | null;
};

type ReopenRequest = {
  id: string;
  fiscalPeriodId: string;
  requestedById: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedById: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

type Dialog = 'create' | 'close' | 'reopen' | null;

export function PeriodsView({ locale = 'fr' }: { locale?: string }) {
  const ar = locale === 'ar';
  const [periods, setPeriods] = useState<Period[]>([]);
  const [requests, setRequests] = useState<Record<string, ReopenRequest[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [dialog, setDialog] = useState<Dialog>(null);
  const [target, setTarget] = useState<Period | null>(null);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', reason: '', note: '' });
  const [showRequests, setShowRequests] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/accounting/periods');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Chargement des périodes impossible');
      setPeriods(json.data);
      // Reopen-request queues only matter for closed periods and require the
      // exceptional capability; a 403 means this actor cannot participate.
      const closed = json.data.filter((p: Period) => p.status === 'closed') as Period[];
      const qs = await Promise.all(closed.map(async (p) => {
        const r = await fetch(`/api/finance/accounting/periods/${p.id}/reopen-requests`);
        const j = await r.json();
        return [p.id, j.success ? (j.data as ReopenRequest[]) : []] as const;
      }));
      setRequests(Object.fromEntries(qs));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const api = async (url: string, init: RequestInit): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await fetch(url, init);
      const json = await res.json();
      if (!res.ok) return { ok: false, message: json.error?.message ?? 'Erreur serveur' };
      return { ok: true };
    } catch (cause) {
      return { ok: false, message: cause instanceof Error ? cause.message : 'Erreur réseau' };
    }
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const outcome = await api('/api/finance/accounting/periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), startDate: form.startDate, endDate: form.endDate }),
    });
    setBusy(false);
    if (outcome.ok) { setNotice('Période créée.'); setDialog(null); setForm({ name: '', startDate: '', endDate: '', reason: '', note: '' }); load(); }
    else setError(outcome.message ?? 'Échec de la création');
  };

  const submitClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    const outcome = await api(`/api/finance/accounting/periods/${target.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: form.reason.trim() }),
    });
    setBusy(false);
    if (outcome.ok) { setNotice('Période clôturée. Un instantané immuable a été écrit.'); setDialog(null); setTarget(null); setForm({ name: '', startDate: '', endDate: '', reason: '', note: '' }); load(); }
    else setError(outcome.message ?? 'Échec de la clôture');
  };

  const submitReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    const outcome = await api(`/api/finance/accounting/periods/${target.id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: form.reason.trim() }),
    });
    setBusy(false);
    if (outcome.ok) { setNotice('Demande de réouverture soumise. Un autre acteur habilité doit l’approuver.'); setDialog(null); setTarget(null); setForm({ name: '', startDate: '', endDate: '', reason: '', note: '' }); load(); }
    else setError(outcome.message ?? 'Échec de la demande de réouverture');
  };

  const decide = async (request: ReopenRequest, decision: 'approved' | 'rejected') => {
    setBusy(true);
    const outcome = await api(`/api/finance/accounting/periods/${request.fiscalPeriodId}/reopen-requests/${request.id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, note: form.note.trim() || undefined }),
    });
    setBusy(false);
    if (outcome.ok) { setNotice(decision === 'approved' ? 'Réouverture approuvée — la période est à nouveau ouverte.' : 'Demande de réouverture rejetée.'); setForm(f => ({ ...f, note: '' })); load(); }
    else setError(outcome.message ?? 'Échec de la décision');
  };

  const openDialog = (kind: Dialog, period?: Period) => {
    setDialog(kind);
    setTarget(period ?? null);
    setForm(f => ({ ...f, reason: '', note: '' }));
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR');

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{ar ? 'الفترات المحاسبية' : 'Périodes comptables'}</h1>
          <p className="text-sm text-slate-500">{ar ? 'إقفال موثق وإعادة فتح استثنائية بموافقة شخص آخر.' : 'Clôture (évidence immuable) et réouverture exceptionnelle en deux étapes — demandeur puis approbateur distinct.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            {ar ? 'تحديث' : 'Actualiser'}
          </Button>
          <Button onClick={() => openDialog('create')}>
            <PlusCircle className="size-3.5" />
            {ar ? 'فترة جديدة' : 'Nouvelle période'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Période</th>
                <th className="px-4 py-3">Du</th>
                <th className="px-4 py-3">Au</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Réouvertures</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {periods.map(p => {
                const queue = requests[p.id] ?? [];
                const pending = queue.filter(q => q.status === 'pending');
                return (
                  <React.Fragment key={p.id}>
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-bold text-slate-900">{p.name}</td>
                      <td className="px-4 py-3">{fmt(p.startDate)}</td>
                      <td className="px-4 py-3">{fmt(p.endDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${p.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                          {p.status === 'open' ? <Unlock className="size-3" /> : <Lock className="size-3" />}
                          {p.status === 'open' ? 'Ouverte' : 'Clôturée'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setShowRequests(s => ({ ...s, [p.id]: !s[p.id] }))} className="font-bold text-[#0066FF] hover:underline">
                          {queue.length} demande(s){pending.length > 0 ? ` (${pending.length} en attente)` : ''}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex justify-end gap-2">
                          {p.status === 'open' && <Button size="sm" variant="outline" onClick={() => openDialog('close', p)}>Clôturer</Button>}
                          {p.status === 'closed' && <Button size="sm" variant="outline" onClick={() => openDialog('reopen', p)}>Demander réouverture</Button>}
                        </div>
                      </td>
                    </tr>
                    {showRequests[p.id] && (
                      <tr>
                        <td colSpan={6} className="bg-slate-50/70 px-4 py-3">
                          {queue.length === 0 ? (
                            <span className="text-xs text-slate-500">Aucune demande de réouverture.</span>
                          ) : (
                            <div className="space-y-2">
                              {queue.map(q => (
                                <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900">{q.reason}</p>
                                    <p className="text-[11px] text-slate-500">
                                      Demandée le {new Date(q.createdAt).toLocaleString('fr-FR')} · Statut : {q.status === 'pending' ? 'en attente' : q.status}
                                      {q.decidedAt ? ` · Décidée le ${new Date(q.decidedAt).toLocaleString('fr-FR')}` : ''}
                                      {q.decisionNote ? ` — ${q.decisionNote}` : ''}
                                    </p>
                                  </div>
                                  {q.status === 'pending' && (
                                    <div className="flex items-center gap-2">
                                      <Input placeholder="Note (optionnel)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-8 w-56 text-xs" />
                                      <Button size="sm" disabled={busy} onClick={() => decide(q, 'approved')}>Approuver</Button>
                                      <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(q, 'rejected')}>
                                        <XCircle className="size-3.5" />
                                        Rejeter
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {periods.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucune période. Créez la première période comptable.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {dialog === 'create' && (
        <Modal title="Nouvelle période" onClose={() => setDialog(null)}>
          <form onSubmit={submitCreate} className="space-y-4">
            <Field label="Nom">
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex. 2025-2026" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Début">
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
              </Field>
              <Field label="Fin">
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
              </Field>
            </div>
            <ModalActions busy={busy} label="Créer la période" />
          </form>
        </Modal>
      )}

      {dialog === 'close' && target && (
        <Modal title={`Clôturer — ${target.name}`} onClose={() => setDialog(null)}>
          <form onSubmit={submitClose} className="space-y-4">
            <p className="text-xs text-slate-500">
              La clôture bloque toute nouvelle écriture après la date de fin et écrit un instantané immuable du grand livre. Motif obligatoire.
            </p>
            <Field label="Motif de clôture">
              <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Motif (min. 3 caractères)" required minLength={3} />
            </Field>
            <ModalActions busy={busy} label="Clôturer la période" />
          </form>
        </Modal>
      )}

      {dialog === 'reopen' && target && (
        <Modal title={`Réouverture — ${target.name}`} onClose={() => setDialog(null)}>
          <form onSubmit={submitReopen} className="space-y-4">
            <p className="text-xs text-slate-500">
              Procédure exceptionnelle en deux étapes : cette demande doit ensuite être approuvée par un acteur distinct (ouverture du cadenas, l’évidence de clôture est dépassée).
            </p>
            <Field label="Motif détaillé">
              <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Motif (min. 10 caractères)" required minLength={10} />
            </Field>
            <ModalActions busy={busy} label="Soumettre la demande" />
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle className="size-5" /></button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ModalActions({ busy, label }: { busy: boolean; label: string }) {
  return (
    <Button type="submit" disabled={busy} className="w-full">
      {busy ? 'Traitement…' : label}
    </Button>
  );
}
