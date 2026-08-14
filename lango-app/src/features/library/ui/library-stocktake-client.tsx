'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

type Stocktake = { id: string; branchId: string; state: string; startedAt: string; closedAt: string | null };

export function LibraryStocktakeClient() {
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [branchId, setBranchId] = useState('');
  const [obs, setObs] = useState<Record<string, { copyId: string; found: string; note: string }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/addons/library/stocktakes', { cache: 'no-store' });
    const j = await r.json(); if (j.success) setStocktakes(j.data);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post(path: string, body: object, ok: string) {
    setBusy(true); setMessage(null);
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      setMessage(j.success ? ok : j.error?.message ?? 'Échec de l’opération.');
      if (j.success) { setBranchId(''); await load(); }
    } finally { setBusy(false); }
  }
  function start() { void post('/api/addons/library/stocktakes', { branchId }, 'Inventaire ouvert.'); }
  function observe(stocktake: Stocktake) {
    const o = obs[stocktake.id]; if (!o?.copyId) { setMessage('Saisissez un UUID d’exemplaire.'); return; }
    void post(`/api/addons/library/stocktakes/${stocktake.id}/observations`, { copyId: o.copyId, found: o.found === 'found', note: o.note.trim() || null }, 'Observation enregistrée.');
    setObs(prev => ({ ...prev, [stocktake.id]: { copyId: '', found: 'found', note: '' } }));
  }
  function close(stocktake: Stocktake) { void post(`/api/addons/library/stocktakes/${stocktake.id}/close`, {}, 'Inventaire clôturé.'); }
  function apply(stocktake: Stocktake) { void post(`/api/addons/library/stocktakes/${stocktake.id}/adjustments/apply`, {}, 'Ajustements appliqués.'); }

  const shortId = (s: string) => s.slice(0, 8);

  return <div className="mx-auto max-w-[1600px] space-y-6 p-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Inventaire (stocktake)</h1><p className="mt-1 text-sm text-slate-500">Comptage physique des exemplaires par succursale.</p></div><Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button></div>
    <Card className="flex flex-wrap items-end gap-3 p-5"><div className="flex-1"><label className="mb-1 block text-xs font-bold text-slate-700">UUID de la succursale</label><Input value={branchId} onChange={e => setBranchId(e.target.value)} placeholder="Ex : ca40c88e-…" /></div><Button disabled={busy || !branchId} onClick={start}><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir un inventaire</Button></Card>
    {message && <p role="status" className="text-sm">{message}</p>}
    <div className="space-y-4">{stocktakes.length === 0 ? <Card className="p-10 text-center"><ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Aucun inventaire</p></Card> : stocktakes.map(stocktake => <Card key={stocktake.id} className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Inventaire {shortId(stocktake.id)}</h3><p className="text-xs text-slate-500">Succursale {shortId(stocktake.branchId)} · ouvert le {new Date(stocktake.startedAt).toLocaleDateString('fr-FR')}</p></div><div className="flex items-center gap-2"><Badge variant={stocktake.state === 'open' ? 'warning' : 'success'}>{stocktake.state === 'open' ? 'Ouvert' : 'Clôturé'}</Badge>{stocktake.state === 'open' ? <><Button variant="outline" size="sm" disabled={busy} onClick={() => close(stocktake)}>Clôturer</Button></> : <Button variant="outline" size="sm" disabled={busy} onClick={() => apply(stocktake)}>Appliquer les ajustements</Button>}</div></div>{stocktake.state === 'open' && <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_150px_1fr_auto]"><Input value={obs[stocktake.id]?.copyId ?? ''} onChange={e => setObs(prev => ({ ...prev, [stocktake.id]: { copyId: e.target.value, found: prev[stocktake.id]?.found ?? 'found', note: prev[stocktake.id]?.note ?? '' } }))} placeholder="UUID de l’exemplaire" /><Select value={obs[stocktake.id]?.found ?? 'found'} onValueChange={v => setObs(prev => ({ ...prev, [stocktake.id]: { copyId: prev[stocktake.id]?.copyId ?? '', found: v, note: prev[stocktake.id]?.note ?? '' } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="found">Trouvé</SelectItem><SelectItem value="missing">Non trouvé</SelectItem></SelectContent></Select><Input value={obs[stocktake.id]?.note ?? ''} onChange={e => setObs(prev => ({ ...prev, [stocktake.id]: { copyId: prev[stocktake.id]?.copyId ?? '', found: prev[stocktake.id]?.found ?? 'found', note: e.target.value } }))} placeholder="Note (facultatif)" /><Button size="sm" disabled={busy} onClick={() => observe(stocktake)}>Enregistrer</Button></div>}</Card>)}</div>
  </div>;
}
