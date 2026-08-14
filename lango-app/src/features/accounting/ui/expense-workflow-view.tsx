'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Expense = { id: string; documentDate: string; reference: string | null; counterparty: string | null; description: string; totalAmount: string; status: string; createdById: string; approvedById: string | null; journalEntryId: string | null };

export function ExpenseWorkflowView({ locale = 'fr' }: { locale?: string }) {
  const ar = locale === 'ar';
  const [rows, setRows] = useState<Expense[]>([]); const [error, setError] = useState<string | null>(null); const [working, setWorking] = useState<string | null>(null);
  const [posting, setPosting] = useState({ journalCode: '', voucherTypeCode: '' });
  const load = useCallback(async () => { const response = await fetch('/api/finance/accounting/expenses'); const json = await response.json(); if (response.ok) setRows(json.data); else setError(json.error?.message ?? 'Chargement impossible'); }, []);
  useEffect(() => { void load(); }, [load]);
  const action = async (row: Expense, name: 'submit' | 'approve' | 'reject' | 'post') => {
    setWorking(row.id); setError(null);
    const body = name === 'reject' ? { reason: window.prompt('Motif du rejet') ?? '' } : name === 'post' ? { ...posting, idempotencyKey: `expense:${row.id}:v1` } : undefined;
    try { const response = await fetch(`/api/finance/accounting/expenses/${row.id}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const json = await response.json(); if (!response.ok) throw new Error(json.error?.message ?? 'Action impossible'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Action impossible'); } finally { setWorking(null); }
  };
  return <div className="mx-auto max-w-7xl space-y-6"><div><h1 className="text-2xl font-extrabold text-[#16212B]">{ar ? 'المصروفات قيد المعالجة' : 'Dépenses à traiter'}</h1><p className="mt-1 text-xs text-slate-500">{ar ? 'فصل الإعداد والموافقة والترحيل المحاسبي.' : 'Séparation préparation, approbation et comptabilisation.'}</p></div>
    {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <Card className="grid gap-3 rounded-2xl p-4 sm:grid-cols-2"><label className="text-xs font-bold">Code journal<Input value={posting.journalCode} onChange={event => setPosting({ ...posting, journalCode: event.target.value.toUpperCase() })} className="mt-1" /></label><label className="text-xs font-bold">Type de pièce dépense<Input value={posting.voucherTypeCode} onChange={event => setPosting({ ...posting, voucherTypeCode: event.target.value.toUpperCase() })} className="mt-1" /></label></Card>
    <Card className="overflow-x-auto rounded-2xl"><table className="w-full text-start text-xs"><thead className="bg-slate-50"><tr><th className="p-3">Date</th><th className="p-3">Référence</th><th className="p-3">Fournisseur</th><th className="p-3">Montant</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.id}><td className="p-3">{row.documentDate}</td><td className="p-3 font-mono">{row.reference}</td><td className="p-3">{row.counterparty}</td><td className="p-3 font-bold">{row.totalAmount} MAD</td><td className="p-3 font-semibold">{row.status}</td><td className="p-3"><div className="flex flex-wrap gap-2">{row.status === 'draft' && <Button size="sm" disabled={working === row.id} onClick={() => void action(row, 'submit')}>Soumettre</Button>}{row.status === 'pending_approval' && <><Button size="sm" disabled={working === row.id} onClick={() => void action(row, 'approve')}>Approuver</Button><Button size="sm" variant="outline" disabled={working === row.id} onClick={() => void action(row, 'reject')}>Rejeter</Button></>}{row.status === 'approved' && <Button size="sm" disabled={working === row.id || !posting.journalCode || !posting.voucherTypeCode} onClick={() => void action(row, 'post')}>Comptabiliser</Button>}</div></td></tr>)}</tbody></table></Card>
  </div>;
}
