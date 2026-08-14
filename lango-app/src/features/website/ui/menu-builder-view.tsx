'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowDown, ArrowUp, Loader2, Menu as MenuIcon, Plus, Trash2 } from 'lucide-react';

type LinkType = 'page' | 'external' | 'anchor';

type MenuItem = {
  id: string;
  label: string;
  linkType: LinkType;
  linkValue: string;
  sortOrder: number;
};

const PAGE_OPTIONS = [
  { value: 'home', label: 'Accueil' },
  { value: 'about', label: 'À propos' },
  { value: 'gallery', label: 'Galerie' },
  { value: 'faq', label: 'FAQ' },
  { value: 'contact', label: 'Contact' },
  { value: 'services', label: 'Services' },
  { value: 'news', label: 'Actualités' },
];

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  page: 'Page du site',
  external: 'URL externe',
  anchor: 'Ancre (#id)',
};

export function MenuBuilderView() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('page');
  const [linkValue, setLinkValue] = useState('home');
  const [creating, setCreating] = useState(false);

  const load = () => fetch('/api/settings/website/menu-items')
    .then(r => r.json())
    .then((j) => { if (j.success) setItems(j.data); });

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const create = async () => {
    if (!label.trim() || !linkValue.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/website/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), linkType, linkValue: linkValue.trim(), sortOrder: items.length }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error?.message ?? 'Échec de la création');
      setLabel('');
      setLinkValue(linkType === 'page' ? 'home' : '');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer cet élément de menu ?')) return;
    const res = await fetch(`/api/settings/website/menu-items/${id}`, { method: 'DELETE' });
    const j = await res.json();
    if (j.success) load();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    if (!a || !b) return;
    await Promise.all([
      fetch(`/api/settings/website/menu-items/${a.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/settings/website/menu-items/${b.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ]);
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <MenuIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Site Web — Menu</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Liste ordonnée des liens de navigation du site public.</p>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl p-3">{error}</div>}

      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <h2 className="text-sm font-extrabold text-[#16212B]">Ajouter un élément</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Libellé</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Accueil" className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Type de lien</Label>
            <Select value={linkType} onValueChange={v => { setLinkType(v as LinkType); setLinkValue(v === 'page' ? 'home' : ''); }}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(LINK_TYPE_LABELS) as LinkType[]).map(t => (
                  <SelectItem key={t} value={t}>{LINK_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Cible</Label>
            {linkType === 'page'
              ? (
                  <Select value={linkValue} onValueChange={setLinkValue}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAGE_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )
              : (
                  <Input
                    value={linkValue}
                    onChange={e => setLinkValue(e.target.value)}
                    placeholder={linkType === 'external' ? 'https://...' : '#section'}
                    className="text-sm"
                  />
                )}
          </div>
          <Button onClick={create} disabled={creating} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 cursor-pointer">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Ajouter</span>
          </Button>
        </div>
      </Card>

      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <th className="pb-2">Ordre</th>
              <th className="pb-2">Libellé</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Cible</th>
              <th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-slate-400 italic">Aucun élément de menu.</td></tr>
            )}
            {items.map((item, i) => (
              <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="py-3">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-[#2487B8] disabled:opacity-30 cursor-pointer">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-slate-400 hover:text-[#2487B8] disabled:opacity-30 cursor-pointer">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td className="py-3 font-bold text-[#16212B]">{item.label}</td>
                <td className="py-3"><Badge variant="info">{LINK_TYPE_LABELS[item.linkType]}</Badge></td>
                <td className="py-3 text-slate-500 font-mono">{item.linkValue}</td>
                <td className="py-3 text-right">
                  <button type="button" onClick={() => remove(item.id)} className="text-slate-400 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
