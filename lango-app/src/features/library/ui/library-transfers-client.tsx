'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Transfer = { id: string; copyId: string; fromBranchId: string; toBranchId: string; state: string; note: string | null; createdAt: string; dispatchedAt: string | null; receivedAt: string | null };

const STATE_LABELS: Record<string, { label: string; cls: string }> = {
  requested: { label: 'Demandé', cls: 'bg-amber-50 text-amber-700' },
  dispatched: { label: 'Expédié', cls: 'bg-blue-50 text-[#2487B8]' },
  discrepancy: { label: 'Écart signalé', cls: 'bg-rose-50 text-rose-600' },
  received: { label: 'Reçu', cls: 'bg-[#DDF5EC] text-[#17A673]' },
  cancelled: { label: 'Annulé', cls: 'bg-slate-100 text-slate-500' },
};
const ACTIONS: Record<string, { label: string; action: string }[]> = {
  requested: [{ label: 'Expédier', action: 'dispatch' }, { label: 'Annuler', action: 'cancel' }],
  dispatched: [{ label: 'Recevoir', action: 'receive' }, { label: 'Signaler un écart', action: 'report_discrepancy' }],
  discrepancy: [{ label: 'Recevoir', action: 'receive' }],
};

export function LibraryTransfersClient() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [copyId, setCopyId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/addons/library/transfers', { cache: 'no-store' });
    const j = await r.json(); if (j.success) setTransfers(j.data);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post(path: string, body: object, ok: string) {
    setBusy(true); setMessage(null);
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      setMessage(j.success ? ok : j.error?.message ?? 'Échec de l’opération.');
      if (j.success) { setCopyId(''); setToBranchId(''); setNote(''); await load(); }
    } finally { setBusy(false); }
  }
  function create() { void post('/api/addons/library/transfers', { copyId, toBranchId, note: note.trim() || undefined }, 'Transfert demandé.'); }
  function transition(t: Transfer, action: string) { void post(`/api/addons/library/transfers/${t.id}/transition`, { action }, `Transfert ${ACTION_LABEL(action)}.`); }

  function ACTION_LABEL(a: string) { return ({ dispatch: 'expédié', receive: 'reçu', cancel: 'annulé', report_discrepancy: 'signalé' } as Record<string, string>)[a] ?? a; }

  const shortId = (s: string) => s.slice(0, 8);

  return <div className="mx-auto max-w-[1600px] space-y-6 p-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Transferts d’exemplaires</h1><p className="mt-1 text-sm text-slate-500">Mouvements entre succursales.</p></div><Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button></div>
    <Card className="space-y-4 p-5"><h2 className="font-semibold">Demander un transfert</h2><div className="grid gap-2 sm:grid-cols-3"><Input value={copyId} onChange={e => setCopyId(e.target.value)} placeholder="UUID de l’exemplaire" /><Input value={toBranchId} onChange={e => setToBranchId(e.target.value)} placeholder="UUID de la succursale de destination" /><Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (facultatif)" /></div><Button disabled={busy || !copyId || !toBranchId} onClick={create}>Créer la demande</Button>{message && <p role="status" className="text-sm">{message}</p>}</Card>
    <Card className="p-4">{transfers.length === 0 ? <div className="py-12 text-center"><Truck className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Aucun transfert</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Exemplaire</th><th className="p-3">De</th><th className="p-3">Vers</th><th className="p-3">Statut</th><th className="p-3">Note</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{transfers.map(t => { const s = STATE_LABELS[t.state] ?? { label: t.state, cls: 'bg-slate-100 text-slate-500' }; return <tr key={t.id} className="border-b last:border-0"><td className="p-3 font-mono text-xs">{shortId(t.copyId)}</td><td className="p-3 font-mono text-xs">{shortId(t.fromBranchId)}</td><td className="p-3 font-mono text-xs">{shortId(t.toBranchId)}</td><td className="p-3"><Badge className={s.cls}>{s.label}</Badge></td><td className="p-3 text-xs">{t.note ?? '—'}</td><td className="p-3 text-right"><div className="flex justify-end gap-2">{(ACTIONS[t.state] ?? []).map(a => <Button key={a.action} variant="outline" size="sm" disabled={busy} onClick={() => transition(t, a.action)}>{a.label}</Button>)}</div></td></tr>; })}</tbody></table></div>}</Card>
  </div>;
}
