'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type CatalogRecord = {
  id: string;
  title: string;
  subtitle: string | null;
  language: string | null;
  editions: Array<{ id: string; isbn13: string | null; isbn10: string | null; copies: { total: number; available: number } }>;
};

export function LibraryCatalogClient({ locale: _locale }: { locale?: string }) {
  const [records, setRecords] = useState<CatalogRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (search = '') => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/addons/library/catalog?q=${encodeURIComponent(search)}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Catalogue indisponible.');
      setRecords(Array.isArray(json.data) ? json.data : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Catalogue indisponible.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = records.reduce((acc, record) => {
    for (const edition of record.editions) { acc.total += Number(edition.copies.total); acc.available += Number(edition.copies.available); }
    return acc;
  }, { total: 0, available: 0 });

  return <div className="mx-auto max-w-[1800px] space-y-6 p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-extrabold text-[#16212B]">Bibliothèque — Catalogue</h1><p className="mt-1 text-sm text-slate-500">Données réelles, filtrées pour votre établissement.</p></div>
      <Button variant="outline" onClick={() => load(query)} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualiser</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="p-4"><p className="text-sm text-slate-500">Notices</p><p className="text-2xl font-bold">{records.length}</p></Card>
      <Card className="p-4"><p className="text-sm text-slate-500">Exemplaires</p><p className="text-2xl font-bold">{totals.total}</p></Card>
      <Card className="p-4"><p className="text-sm text-slate-500">Disponibles</p><p className="text-2xl font-bold text-emerald-700">{totals.available}</p></Card>
    </div>
    <Card className="p-4">
      <form className="mb-4 flex gap-2" onSubmit={e => { e.preventDefault(); void load(query); }}>
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={e => setQuery(e.target.value)} className="pl-9" placeholder="Rechercher un titre…" /></div>
        <Button type="submit">Rechercher</Button>
      </form>
      {error ? <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{error}</div> : loading ? <div className="py-12 text-center text-sm text-slate-500">Chargement du catalogue…</div> : records.length === 0 ? <div className="py-12 text-center"><BookOpen className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Aucun ouvrage trouvé</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Titre</th><th className="p-3">Langue</th><th className="p-3">ISBN</th><th className="p-3 text-right">Exemplaires</th><th className="p-3 text-right">Disponibles</th></tr></thead><tbody>{records.map(record => { const total = record.editions.reduce((n,e) => n + Number(e.copies.total), 0); const available = record.editions.reduce((n,e) => n + Number(e.copies.available), 0); return <tr key={record.id} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{record.title}</div>{record.subtitle && <div className="text-xs text-slate-500">{record.subtitle}</div>}</td><td className="p-3">{record.language ?? '—'}</td><td className="p-3 font-mono text-xs">{record.editions[0]?.isbn13 ?? record.editions[0]?.isbn10 ?? '—'}</td><td className="p-3 text-right">{total}</td><td className="p-3 text-right"><Badge variant={available > 0 ? 'success' : 'neutral'}>{available}</Badge></td></tr>; })}</tbody></table></div>}
    </Card>
  </div>;
}
