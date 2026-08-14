'use client';

import { useCallback, useEffect, useState } from 'react';
import { Receipt, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Charge = { id: string; memberId: string; loanId: string | null; amount: string; reason: string; state: string; waivedById: string | null; waivedAt: string | null; waiverReason: string | null; createdAt: string };

const STATE_LABELS: Record<string, { label: string; cls: string }> = {
  open: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
  waived: { label: 'Annulé', cls: 'bg-slate-100 text-slate-500' },
  posted: { label: 'Comptabilisé', cls: 'bg-[#DDF5EC] text-[#17A673]' },
};
const REASON_LABELS: Record<string, string> = { overdue_fine: 'Amende de retard', lost_copy: 'Exemplaire perdu', damage: 'Dommage' };

export function LibraryChargesClient() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/addons/library/charges', { cache: 'no-store' });
    const j = await r.json(); if (j.success) setCharges(j.data);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post(path: string, body: object, ok: string) {
    setBusy(true); setMessage(null);
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.success) setMessage(j.data?.blocked ? `Comptabilisation bloquée : ${j.data.reason ?? 'exception de comptabilité.'}` : ok);
      else setMessage(j.error?.message ?? 'Échec de l’opération.');
      await load();
    } finally { setBusy(false); setPosting(null); }
  }
  function waive(c: Charge) { const reason = window.prompt('Motif de l’annulation'); if (reason) void post(`/api/addons/library/charges/${c.id}/waive`, { reason }, 'Frais annulés.'); }
  function postCharge(c: Charge) {
    setPosting(c.id);
    const journalCode = window.prompt('Code journal (ex : CAISSE)');
    if (!journalCode) { setPosting(null); return; }
    const voucherTypeCode = window.prompt('Code type pièce (ex : RECU)');
    if (!voucherTypeCode) { setPosting(null); return; }
    void post(`/api/addons/library/charges/${c.id}/post`, { journalCode, voucherTypeCode }, 'Frais comptabilisés.');
  }

  return <div className="mx-auto max-w-[1600px] space-y-6 p-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Frais de bibliothèque</h1><p className="mt-1 text-sm text-slate-500">Amendes et frais pour perte, avec annulation et comptabilisation.</p></div><Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
    <Card className="p-4">{charges.length === 0 ? <div className="py-12 text-center"><Receipt className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Aucun frais</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Motif</th><th className="p-3">Montant</th><th className="p-3">Statut</th><th className="p-3">Créé le</th><th className="p-3">Détail</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{charges.map(c => { const s = STATE_LABELS[c.state] ?? { label: c.state, cls: 'bg-slate-100 text-slate-500' }; return <tr key={c.id} className="border-b last:border-0"><td className="p-3 font-medium">{REASON_LABELS[c.reason] ?? c.reason}</td><td className="p-3 font-bold">{Number(c.amount).toFixed(2)} DH</td><td className="p-3"><Badge className={s.cls}>{s.label}</Badge></td><td className="p-3">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td><td className="p-3 text-xs">{c.waiverReason ?? `Adhérent ${c.memberId.slice(0, 8)}`}</td><td className="p-3 text-right"><div className="flex justify-end gap-2">{c.state === 'open' && <><Button variant="outline" size="sm" disabled={busy} onClick={() => waive(c)}>Annuler</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => postCharge(c)}>{posting === c.id ? '…' : 'Comptabiliser'}</Button></>}</div></td></tr>; })}</tbody></table></div>}</Card>
  </div>;
}
