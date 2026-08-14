'use client';

import { useCallback, useEffect, useState } from 'react';
import { FolderTree, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Item = { id: string; name: string; primaryRole?: string | null; city?: string | null; country?: string | null; parentId?: string | null };

const TABS = [['categories', 'Catégories'], ['contributors', 'Contributeurs'], ['publishers', 'Éditeurs'], ['subjects', 'Sujets']] as const;
const BASE: Record<string, string> = { categories: 'categories', contributors: 'contributors', publishers: 'publishers', subjects: 'subjects' };

export function LibraryTaxonomyClient() {
  const [tab, setTab] = useState<string>('categories');
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [extra, setExtra] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMessage(null);
    const r = await fetch(`/api/addons/library/catalog/${BASE[tab]}`, { cache: 'no-store' });
    const j = await r.json(); if (j.success) setItems(j.data ?? []);
  }, [tab]);
  useEffect(() => { void load(); }, [load]);

  async function post(path: string, method: string, body: object, ok: string) {
    setBusy(true); setMessage(null);
    try {
      const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      setMessage(j.success ? ok : j.error?.message ?? 'Échec de l’opération.');
      if (j.success) { setName(''); setExtra(''); await load(); }
    } finally { setBusy(false); }
  }
  function create() {
    const base = { categories: { name, parentId: extra || null }, contributors: { name, primaryRole: extra || null }, publishers: { name, city: extra || null }, subjects: { name } } as Record<string, Record<string, unknown>>;
    void post(`/api/addons/library/catalog/${BASE[tab]}`, 'POST', base[tab]!, 'Élément ajouté.');
  }
  function remove(item: Item) { if (window.confirm(`Supprimer « ${item.name} » ?`)) void post(`/api/addons/library/catalog/${BASE[tab]}/${item.id}`, 'DELETE', {}, 'Élément supprimé.'); }

  const extraPlaceholder = tab === 'categories' ? 'Catégorie parente (UUID, facultatif)' : tab === 'contributors' ? 'Rôle principal (facultatif)' : tab === 'publishers' ? 'Ville (facultatif)' : '';

  return <div className="mx-auto max-w-[1600px] space-y-6 p-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Taxonomie du catalogue</h1><p className="mt-1 text-sm text-slate-500">Catégories, contributeurs, éditeurs et sujets.</p></div><Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button></div>
    <div className="flex flex-wrap gap-2">{TABS.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg border px-4 py-2 text-sm font-medium ${tab === key ? 'border-[#2487B8] bg-blue-50 text-[#1B6C93]' : 'bg-white text-slate-600'}`}>{label}</button>)}</div>
    {message && <p role="status" className="text-sm">{message}</p>}
    <Card className="flex flex-wrap items-end gap-3 p-5"><div className="min-w-56 flex-1"><label className="mb-1 block text-xs font-bold text-slate-700">Nom</label><Input value={name} onChange={e => setName(e.target.value)} placeholder={`Nom du ${tab === 'contributors' ? 'contributeur' : tab === 'publishers' ? 'éditeur' : tab === 'subjects' ? 'sujet' : 'catégorie'}`} /></div>{extraPlaceholder && <div className="min-w-56 flex-1"><label className="mb-1 block text-xs font-bold text-slate-700">Option</label><Input value={extra} onChange={e => setExtra(e.target.value)} placeholder={extraPlaceholder} /></div>}<Button disabled={busy || !name.trim()} onClick={create}><Plus className="mr-2 h-4 w-4" />Ajouter</Button></Card>
    <Card className="p-4">{items.length === 0 ? <div className="py-12 text-center"><FolderTree className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Aucun élément</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Nom</th>{tab !== 'subjects' && <th className="p-3">Détail</th>}<th className="p-3 text-right">Action</th></tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-b last:border-0"><td className="p-3 font-semibold">{item.name}</td>{tab !== 'subjects' && <td className="p-3 text-xs text-slate-500">{item.primaryRole ?? item.city ?? (item.parentId ? `Parent ${item.parentId.slice(0, 8)}` : '—')}</td>}<td className="p-3 text-right"><Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(item)}><Trash2 className="h-4 w-4 text-rose-600" /></Button></td></tr>)}</tbody></table></div>}</Card>
  </div>;
}
