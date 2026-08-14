'use client';

import { AlertCircle, CheckCircle2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Mapping = {
  id: string;
  sourceModule: string;
  sourceKeyType: string;
  sourceKey: string | null;
  accountId: string;
  accountCode?: string;
  accountName?: string;
};

type AdapterException = {
  id: string;
  sourceModule: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  version: number;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  resolutionNote: string | null;
};

type ReconRow = {
  sourceModule: string;
  documentType: string;
  documentId: string;
  number: string;
  amount: string;
  state: 'posted' | 'blocked' | 'pending';
  entryNumber: string | null;
  reason: string | null;
};

type Recon = {
  rows: ReconRow[];
  summary: { sourceTotal: string; postedTotal: string; blockedTotal: string; pendingTotal: string; drift: string };
  counts: { posted: number; blocked: number; pending: number };
};

type Account = { id: string; code: string; name: string; accountType: string; isActive: boolean };

const KEY_TYPE_LABEL: Record<string, string> = { fee_category: 'Catégorie de frais', payment_method: 'Méthode de paiement', student: 'Étudiant' };
const MODULE_LABEL: Record<string, string> = { student_invoice: 'Facture', student_payment: 'Paiement' };
const STATE_LABEL: Record<string, string> = { posted: 'Comptabilisé', blocked: 'Bloqué', pending: 'En attente' };

export function StudentAccountingView({ locale = 'fr' }: { locale?: string }) {
  const ar = locale === 'ar';
  const [tab, setTab] = useState<'mappings' | 'exceptions' | 'reconciliation'>('mappings');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [exceptions, setExceptions] = useState<AdapterException[]>([]);
  const [recon, setRecon] = useState<Recon | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ sourceModule: 'student_invoice', sourceKeyType: 'fee_category', sourceKey: '', accountId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, e, r, a] = await Promise.all([
        fetch('/api/finance/accounting/student-accounting/mappings').then(r2 => r2.json()),
        fetch('/api/finance/accounting/student-accounting/exceptions').then(r2 => r2.json()),
        fetch('/api/finance/accounting/student-accounting/reconcile').then(r2 => r2.json()),
        fetch('/api/finance/accounting/accounts?pageSize=100').then(r2 => r2.json()),
      ]);
      if (!m.success) throw new Error(m.error?.message ?? 'Chargement des mappings impossible');
      if (!e.success) throw new Error(e.error?.message ?? 'Chargement des exceptions impossible');
      if (!r.success) throw new Error(r.error?.message ?? 'Chargement du rapprochement impossible');
      setMappings(m.data);
      setExceptions(e.data);
      setRecon(r.data);
      setAccounts(a.success ? a.data : []);
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

  const createMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    const outcome = await api('/api/finance/accounting/student-accounting/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceModule: form.sourceModule, sourceKeyType: form.sourceKeyType, sourceKey: form.sourceKey.trim() || null, accountId: form.accountId }),
    });
    if (outcome.ok) {
      setNotice('Mapping enregistré.');
      setShowCreate(false);
      setForm(f => ({ ...f, sourceKey: '', accountId: '' }));
      load();
    } else setError(outcome.message ?? 'Échec de l’enregistrement');
  };

  const deleteMapping = async (id: string) => {
    const outcome = await api(`/api/finance/accounting/student-accounting/mappings/${id}`, { method: 'DELETE' });
    if (outcome.ok) { setNotice('Mapping supprimé.'); load(); }
    else setError(outcome.message ?? 'Échec de la suppression');
  };

  const setExceptionStatus = async (id: string, action: 'resolve' | 'dismiss') => {
    const outcome = await api(`/api/finance/accounting/student-accounting/exceptions/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (outcome.ok) { setNotice(action === 'resolve' ? 'Exception résolue.' : 'Exception ignorée.'); load(); }
    else setError(outcome.message ?? 'Échec de la mise à jour');
  };

  const accountFor = (mapping: Mapping) => accounts.find(a => a.id === mapping.accountId);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{ar ? 'محاسبة الطلاب' : 'Comptabilisation Étudiants'}</h1>
          <p className="text-sm text-slate-500">{ar ? 'ربط الحسابات ومعالجة الاستثناءات ومطابقة المصدر مع دفتر الأستاذ.' : 'Mappings vers le plan comptable, file d’attente des exceptions et rapprochement source → grand livre.'}</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          {ar ? 'تحديث' : 'Actualiser'}
        </Button>
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

      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs font-semibold">
        {(['mappings', 'exceptions', 'reconciliation'] as const).map(key => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-2 ${tab === key ? 'bg-[#0066FF] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {key === 'mappings' ? 'Mappings' : key === 'exceptions' ? `Exceptions (${exceptions.filter(x => x.status === 'open').length})` : 'Rapprochement'}
          </button>
        ))}
      </div>

      {tab === 'mappings' && (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">Mappings source → compte</h3>
            <Button onClick={() => setShowCreate(v => !v)}>{showCreate ? 'Fermer' : 'Nouveau mapping'}</Button>
          </div>
          {showCreate && (
            <form onSubmit={createMapping} className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-5">
              <select value={form.sourceModule} onChange={e => setForm(f => ({ ...f, sourceModule: e.target.value }))} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <option value="student_invoice">Facture</option>
                <option value="student_payment">Paiement</option>
              </select>
              <select value={form.sourceKeyType} onChange={e => setForm(f => ({ ...f, sourceKeyType: e.target.value }))} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <option value="fee_category">Catégorie de frais</option>
                <option value="payment_method">Méthode de paiement</option>
                <option value="student">Étudiant</option>
              </select>
              <Input placeholder="Clé (vide = défaut)" value={form.sourceKey} onChange={e => setForm(f => ({ ...f, sourceKey: e.target.value }))} className="text-xs" />
              <select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <option value="">— Compte —</option>
                {accounts.filter(a => a.isActive).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
              </select>
              <Button type="submit" disabled={!form.accountId || loading}>Enregistrer</Button>
            </form>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Type de clé</th>
                  <th className="px-4 py-3">Clé</th>
                  <th className="px-4 py-3">Compte</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {mappings.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">{MODULE_LABEL[m.sourceModule] ?? m.sourceModule}</td>
                    <td className="px-4 py-3">{KEY_TYPE_LABEL[m.sourceKeyType] ?? m.sourceKeyType}</td>
                    <td className="px-4 py-3">{m.sourceKey ?? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Défaut</span>}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{accountFor(m)?.code} · {accountFor(m)?.name}</td>
                    <td className="px-4 py-3 text-end">
                      <button onClick={() => deleteMapping(m.id)} className="text-red-500 hover:text-red-700"><Trash2 className="size-4" /></button>
                    </td>
                  </tr>
                ))}
                {mappings.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">Aucun mapping. Ajoutez-en un pour débloquer les écritures.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'exceptions' && (
        <Card className="p-0">
          <div className="border-b border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">File d’attente des exceptions (jamais de suspense)</h3>
            <p className="text-xs text-slate-500">Un document sans mapping n’est jamais comptabilisé sur un compte deviné : il reste ici jusqu’à résolution.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Raison</th>
                  <th className="px-4 py-3">Détail</th>
                  <th className="px-4 py-3">Créé le</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {exceptions.map(x => (
                  <tr key={x.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${x.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{x.status}</span>
                    </td>
                    <td className="px-4 py-3">{MODULE_LABEL[x.sourceModule] ?? x.sourceModule}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{x.reason}</td>
                    <td className="px-4 py-3 text-slate-500">{x.detail ?? '—'}</td>
                    <td className="px-4 py-3">{new Date(x.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-end">
                      {x.status === 'open' && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => setExceptionStatus(x.id, 'resolve')}>Résoudre</Button>
                          <Button size="sm" variant="outline" onClick={() => setExceptionStatus(x.id, 'dismiss')}>Ignorer</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {exceptions.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucune exception ouverte.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-5">
            {[
              ['Source', recon?.summary.sourceTotal, 'text-slate-900'],
              ['Comptabilisé', recon?.summary.postedTotal, 'text-emerald-600'],
              ['Bloqué', recon?.summary.blockedTotal, 'text-red-600'],
              ['En attente', recon?.summary.pendingTotal, 'text-amber-600'],
              ['Écart (bloqué + attente)', recon?.summary.drift, 'text-slate-500'],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
                <div className={`mt-1 text-lg font-extrabold ${color}`}>{loading ? '...' : value}</div>
              </div>
            ))}
          </div>
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">État</th>
                    <th className="px-4 py-3">Réf.</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Montant</th>
                    <th className="px-4 py-3">Pièce</th>
                    <th className="px-4 py-3">Raison</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {recon?.rows.map(r => (
                    <tr key={`${r.sourceModule}:${r.documentId}`} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${r.state === 'posted' ? 'bg-emerald-100 text-emerald-700' : r.state === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {r.state === 'blocked' && <XCircle className="size-3" />}
                          {STATE_LABEL[r.state]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{r.number}</td>
                      <td className="px-4 py-3">{r.documentType === 'invoice' ? 'Facture' : 'Paiement'}</td>
                      <td className="px-4 py-3 font-bold">{r.amount} MAD</td>
                      <td className="px-4 py-3 text-slate-500">{r.entryNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-red-600">{r.reason ?? '—'}</td>
                    </tr>
                  ))}
                  {recon?.rows.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucun document source.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
