'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookMarked, RefreshCw, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Hold = { id: string; state: string; placedAt: string; expiresAt: string | null; copyId: string; accessionNumber: string; memberId: string; memberNumber: string; memberName: string };

const STATE_LABELS: Record<string, { label: string; cls: string }> = {
  waiting: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
  fulfilled: { label: 'Honorée', cls: 'bg-[#DDF5EC] text-[#17A673]' },
  cancelled: { label: 'Annulée', cls: 'bg-slate-100 text-slate-500' },
  expired: { label: 'Expirée', cls: 'bg-rose-50 text-rose-600' },
};

export function LibraryHoldsClient() {
  const [holds, setHolds] = useState<Hold[]>([]);
  const [copyId, setCopyId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/addons/library/holds', { cache: 'no-store' });
    const j = await r.json(); if (j.success) setHolds(j.data);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post(path: string, body: object, ok: string) {
    setBusy(true); setMessage(null);
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      setMessage(j.success ? ok : j.error?.message ?? 'Échec de l’opération.');
      if (j.success) { setCopyId(''); setMemberId(''); await load(); }
    } finally { setBusy(false); }
  }
  function place() { void post('/api/addons/library/holds', { copyId, memberId }, 'Réservation créée.'); }
  function cancel(hold: Hold) { const reason = window.prompt('Motif de l’annulation'); if (reason) void post(`/api/addons/library/holds/${hold.id}/cancel`, { reason }, 'Réservation annulée.'); }

  return <div className="mx-auto max-w-[1600px] space-y-6 p-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Réservations</h1><p className="mt-1 text-sm text-slate-500">File d’attente des exemplaires réservés.</p></div><Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button></div>
    <Card className="space-y-4 p-5"><h2 className="font-semibold">Placer une réservation</h2><div className="grid gap-2 sm:grid-cols-2"><Input value={copyId} onChange={e => setCopyId(e.target.value)} placeholder="UUID de l’exemplaire" /><Input value={memberId} onChange={e => setMemberId(e.target.value)} placeholder="UUID de l’adhérent" /></div><Button disabled={busy || !copyId || !memberId} onClick={place}>Créer la réservation</Button>{message && <p role="status" className="text-sm">{message}</p>}</Card>
    <Card className="p-4">{holds.length === 0 ? <div className="py-12 text-center"><BookMarked className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Aucune réservation</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Exemplaire</th><th className="p-3">Adhérent</th><th className="p-3">Placée le</th><th className="p-3">Expiration</th><th className="p-3">Statut</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{holds.map(hold => { const s = STATE_LABELS[hold.state] ?? { label: hold.state, cls: 'bg-slate-100 text-slate-500' }; return <tr key={hold.id} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{hold.accessionNumber}</div></td><td className="p-3">{hold.memberName}<div className="text-xs text-slate-500">{hold.memberNumber}</div></td><td className="p-3">{new Date(hold.placedAt).toLocaleDateString('fr-FR')}</td><td className="p-3">{hold.expiresAt ? new Date(hold.expiresAt).toLocaleDateString('fr-FR') : '—'}</td><td className="p-3"><Badge className={s.cls}>{s.label}</Badge></td><td className="p-3 text-right">{hold.state === 'waiting' ? <Button variant="outline" size="sm" disabled={busy} onClick={() => cancel(hold)}>Annuler</Button> : '—'}</td></tr>; })}</tbody></table></div>}</Card>
  </div>;
}
