'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Journal = { id: string; code: string; name: string; journalType: string };
type Voucher = { id: string; code: string; name: string; journalCode: string; sourceModule: string | null; requiresApproval: boolean; isActive: boolean };

export function VoucherTypesView({ locale = 'fr' }: { locale?: string }) {
  const ar = locale === 'ar';
  const [journals, setJournals] = useState<Journal[]>([]); const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [journal, setJournal] = useState({ code: '', name: '', journalType: 'general' });
  const [voucher, setVoucher] = useState({ code: '', name: '', journalId: '', sourceModule: '', requiresApproval: true });
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [journalsResponse, vouchersResponse] = await Promise.all([fetch('/api/finance/accounting/journals'), fetch('/api/finance/accounting/voucher-types')]);
    const [journalsJson, vouchersJson] = await Promise.all([journalsResponse.json(), vouchersResponse.json()]);
    if (journalsJson.success) setJournals(journalsJson.data); if (vouchersJson.success) setVouchers(vouchersJson.data);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const post = async (url: string, body: unknown) => {
    setError(null); const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const json = await response.json();
    if (!response.ok) throw new Error(json.error?.message ?? 'Enregistrement impossible'); await load();
  };
  return <div className="mx-auto max-w-6xl space-y-6"><div><h1 className="text-2xl font-extrabold text-[#16212B]">{ar ? 'اليوميات وأنواع السندات' : 'Journaux et types de pièces'}</h1><p className="mt-1 text-xs text-slate-500">{ar ? 'الرموز والمصادر المسموح بها والموافقات والتسلسل.' : 'Codes, sources autorisées, approbation et séquences transactionnelles.'}</p></div>
    {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-5 lg:grid-cols-2"><Card className="rounded-2xl p-5"><h2 className="mb-4 font-bold">Nouveau journal</h2><div className="grid gap-3">
      <Input placeholder="Code (GEN, BQ…)" value={journal.code} onChange={event => setJournal({ ...journal, code: event.target.value.toUpperCase() })} />
      <Input placeholder="Nom" value={journal.name} onChange={event => setJournal({ ...journal, name: event.target.value })} />
      <select value={journal.journalType} onChange={event => setJournal({ ...journal, journalType: event.target.value })} className="h-10 rounded-md border px-3 text-sm">{['sales','cash','bank','purchase','general','opening','closing'].map(type => <option key={type}>{type}</option>)}</select>
      <Button onClick={() => void post('/api/finance/accounting/journals', journal).catch(cause => setError(cause.message))}>Créer le journal</Button></div></Card>
      <Card className="rounded-2xl p-5"><h2 className="mb-4 font-bold">Nouveau type de pièce</h2><div className="grid gap-3">
        <Input placeholder="Code" value={voucher.code} onChange={event => setVoucher({ ...voucher, code: event.target.value.toUpperCase() })} /><Input placeholder="Nom" value={voucher.name} onChange={event => setVoucher({ ...voucher, name: event.target.value })} />
        <select value={voucher.journalId} onChange={event => setVoucher({ ...voucher, journalId: event.target.value })} className="h-10 rounded-md border px-3 text-sm"><option value="">Journal…</option>{journals.map(item => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select>
        <Input placeholder="Module source (optionnel)" value={voucher.sourceModule} onChange={event => setVoucher({ ...voucher, sourceModule: event.target.value })} />
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={voucher.requiresApproval} onChange={event => setVoucher({ ...voucher, requiresApproval: event.target.checked })} /> Approbation requise</label>
        <Button onClick={() => void post('/api/finance/accounting/voucher-types', { ...voucher, sourceModule: voucher.sourceModule || null }).catch(cause => setError(cause.message))}>Créer le type</Button></div></Card></div>
    <Card className="overflow-hidden rounded-2xl"><table className="w-full text-start text-xs"><thead className="bg-slate-50"><tr><th className="p-3">Code</th><th className="p-3">Nom</th><th className="p-3">Journal</th><th className="p-3">Source</th><th className="p-3">Contrôle</th></tr></thead><tbody className="divide-y">{vouchers.map(item => <tr key={item.id}><td className="p-3 font-mono font-bold">{item.code}</td><td className="p-3">{item.name}</td><td className="p-3">{item.journalCode}</td><td className="p-3">{item.sourceModule ?? 'Tous'}</td><td className="p-3">{item.requiresApproval ? 'Approbation' : 'Direct'}</td></tr>)}</tbody></table></Card>
  </div>;
}
