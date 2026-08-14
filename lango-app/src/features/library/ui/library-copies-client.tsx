'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookCopy, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

type Copy = { id: string; accessionNumber: string; barcode: string | null; shelfLocation: string | null; condition: string; state: string; title: string; isbn13: string | null; branchName: string };
type Page = { items: Copy[]; total: number; offset: number; limit: number };

const STATE_LABELS: Record<string, string> = { available: 'Disponible', checked_out: 'Prêté', on_hold_shelf: 'Réservé', in_transit: 'En transit', lost: 'Perdu', missing: 'Manquant', repair: 'En réparation', withdrawn: 'Retiré' };
const CONDITION_LABELS: Record<string, string> = { new: 'Neuf', good: 'Bon', fair: 'Correct', poor: 'Médiocre', damaged: 'Endommagé' };
const STATE_FILTERS: [string, string][] = [['all', 'Tous les états'], ['available', 'Disponible'], ['checked_out', 'Prêté'], ['on_hold_shelf', 'Réservé'], ['in_transit', 'En transit'], ['repair', 'En réparation'], ['lost', 'Perdu'], ['missing', 'Manquant']];

export function LibraryCopiesClient() {
  const [page, setPage] = useState<Page>({ items: [], total: 0, offset: 0, limit: 50 });
  const [query, setQuery] = useState('');
  const [state, setState] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (query.trim()) q.set('q', query.trim());
      if (state !== 'all') q.set('state', state);
      const r = await fetch(`/api/addons/library/copies?${q}`, { cache: 'no-store' });
      const j = await r.json();
      if (j.success) setPage(j.data);
    } finally { setLoading(false); }
  }, [query, state]);

  useEffect(() => { void load(); }, [load]);

  const counts = page.items.reduce((acc, c) => { acc[c.state] = (acc[c.state] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return <div className="mx-auto max-w-[1800px] space-y-6 p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Exemplaires & Stock</h1><p className="mt-1 text-sm text-slate-500">Inventaire réel de la bibliothèque ({page.total} exemplaires).</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualiser</Button></div>
    <Card className="p-4">
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void load(); }}>
        <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={e => setQuery(e.target.value)} className="pl-9" placeholder="N° inventaire, code-barres, titre ou ISBN…" /></div>
        <Select value={state} onValueChange={setState}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{STATE_FILTERS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
        <Button type="submit">Filtrer</Button>
      </form>
      {loading ? <div className="py-12 text-center text-sm text-slate-500">Chargement…</div> : page.items.length === 0 ? <div className="py-12 text-center"><BookCopy className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Aucun exemplaire trouvé</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Titre</th><th className="p-3">Inventaire</th><th className="p-3">Code-barres</th><th className="p-3">Succursale</th><th className="p-3">Localisation</th><th className="p-3">État physique</th><th className="p-3">Disponibilité</th></tr></thead><tbody>{page.items.map(copy => <tr key={copy.id} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{copy.title}</div><div className="font-mono text-xs text-slate-500">{copy.isbn13 ?? ''}</div></td><td className="p-3 font-mono text-xs">{copy.accessionNumber}</td><td className="p-3 font-mono text-xs">{copy.barcode ?? '—'}</td><td className="p-3">{copy.branchName}</td><td className="p-3">{copy.shelfLocation ?? '—'}</td><td className="p-3 capitalize">{CONDITION_LABELS[copy.condition] ?? copy.condition}</td><td className="p-3"><Badge variant={copy.state === 'available' ? 'success' : 'neutral'}>{STATE_LABELS[copy.state] ?? copy.state}</Badge></td></tr>)}</tbody></table></div>}
    </Card>
    {Object.keys(counts).length > 0 && <div className="flex flex-wrap gap-2">{Object.entries(counts).map(([s, n]) => <span key={s} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{STATE_LABELS[s] ?? s} : {n}</span>)}</div>}
  </div>;
}
