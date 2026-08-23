'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Copy = { id: string; editionId: string; accessionNumber: string; barcode: string | null; shelfLocation: string | null; condition: string; state: string; price: string | null; branchName: string };
type Edition = { id: string; isbn13: string | null; isbn10: string | null; format: string | null; pages: number | null; publicationYear: number | null; copies: Copy[] };
type Contributor = { id: string; name: string; primaryRole: string | null; role: string | null; sortOrder: number };
type Hold = { id: string; state: string; placedAt: string; copyId: string; memberName: string; memberNumber: string };
type CatalogDetail = { id: string; title: string; subtitle: string | null; language: string | null; publicationYear: number | null; summary: string | null; editions: Edition[]; contributors: Contributor[]; subjects: { id: string; name: string }[]; holds: Hold[] };

const STATE_LABELS: Record<string, string> = { available: 'Disponible', checked_out: 'Prêté', on_hold_shelf: 'Réservé', in_transit: 'En transit', lost: 'Perdu', missing: 'Manquant', repair: 'En réparation', withdrawn: 'Retiré' };

export function LibraryCatalogDetailClient({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<CatalogDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', subtitle: '', language: '', publicationYear: '', summary: '' });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/addons/library/catalog/${recordId}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error?.message ?? 'Notice introuvable.');
      setRecord(j.data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Notice introuvable.'); }
  }, [recordId]);

  useEffect(() => { void load(); }, [load]);

  const openEdit = () => {
    if (!record) return;
    setActionError(null);
    setForm({
      title: record.title,
      subtitle: record.subtitle ?? '',
      language: record.language ?? '',
      publicationYear: record.publicationYear ? String(record.publicationYear) : '',
      summary: record.summary ?? '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!form.title.trim()) { setActionError('Le titre est requis.'); return; }
    setSaving(true); setActionError(null);
    try {
      const r = await fetch(`/api/addons/library/catalog/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || null,
          language: form.language.trim() || null,
          publicationYear: form.publicationYear ? Number(form.publicationYear) : null,
          summary: form.summary.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error?.message ?? 'Échec de la mise à jour.');
      setEditing(false);
      await load();
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Échec de la mise à jour.'); }
    finally { setSaving(false); }
  };

  const removeRecord = async () => {
    if (!record) return;
    if (!window.confirm(`Supprimer la notice « ${record.title} » ?`)) return;
    setActionError(null);
    try {
      const r = await fetch(`/api/addons/library/catalog/${recordId}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error?.message ?? 'Échec de la suppression.');
      router.push('/dashboard/library/catalog');
      router.refresh();
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Échec de la suppression.'); }
  };

  const totalCopies = record?.editions.reduce((n, e) => n + e.copies.length, 0) ?? 0;
  const availableCopies = record?.editions.reduce((n, e) => n + e.copies.filter(c => c.state === 'available').length, 0) ?? 0;

  return <div className="mx-auto max-w-5xl space-y-6 p-6">
    <div className="flex items-center justify-between"><Link href="/dashboard/library/catalog" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Retour au catalogue</Link><div className="flex items-center gap-2">{record && !error && <><Button variant="outline" size="sm" onClick={openEdit}><Pencil className="mr-1 h-3.5 w-3.5" />Modifier</Button><Button variant="outline" size="sm" onClick={() => void removeRecord()} className="text-red-600 hover:text-red-700"><Trash2 className="mr-1 h-3.5 w-3.5" />Supprimer</Button></>}<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Actualiser</Button></div></div>
    {actionError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}
    {error ? <Card className="p-10 text-center"><BookOpen className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">{error}</p></Card> : !record ? <Card className="p-10 text-center text-sm text-slate-500">Chargement…</Card> : <>
      <Card className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-2xl"><h1 className="text-2xl font-extrabold text-[#16212B]">{record.title}</h1>{record.subtitle && <p className="mt-1 text-slate-600">{record.subtitle}</p>}<div className="mt-3 flex flex-wrap gap-2">{record.language && <Badge variant="neutral">{record.language}</Badge>}{record.publicationYear && <Badge variant="neutral">Paru en {record.publicationYear}</Badge>}{record.contributors.map(c => <Badge key={c.id} variant="info">{c.name}{c.role ? ` — ${c.role}` : ''}</Badge>)}</div></div><div className="text-right text-sm"><p className="text-slate-500">Exemplaires</p><p className="text-2xl font-bold">{totalCopies}</p><p className="text-sm text-emerald-700">{availableCopies} disponibles</p></div></div>{record.subjects.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{record.subjects.map(s => <span key={s.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{s.name}</span>)}</div>}{record.summary && <p className="mt-4 text-sm leading-relaxed text-slate-600">{record.summary}</p>}</Card>
      {record.editions.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucune édition enregistrée.</p> : record.editions.map(edition => <Card key={edition.id} className="p-5"><div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><h3 className="font-bold">Édition</h3>{edition.isbn13 && <span className="font-mono text-xs text-slate-500">ISBN13 {edition.isbn13}</span>}{edition.isbn10 && <span className="font-mono text-xs text-slate-500">ISBN10 {edition.isbn10}</span>}{edition.format && <Badge variant="neutral">{edition.format}</Badge>}{edition.pages && <span className="text-xs text-slate-500">{edition.pages} pages</span>}</div>{edition.copies.length === 0 ? <p className="text-sm text-slate-500">Aucun exemplaire.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Inventaire</th><th className="p-2">Code-barres</th><th className="p-2">Localisation</th><th className="p-2">Succursale</th><th className="p-2">État</th><th className="p-2">Disponibilité</th></tr></thead><tbody>{edition.copies.map(copy => <tr key={copy.id} className="border-b last:border-0"><td className="p-2 font-mono text-xs">{copy.accessionNumber}</td><td className="p-2 font-mono text-xs">{copy.barcode ?? '—'}</td><td className="p-2">{copy.shelfLocation ?? '—'}</td><td className="p-2">{copy.branchName}</td><td className="p-2 capitalize">{copy.condition}</td><td className="p-2"><Badge variant={copy.state === 'available' ? 'success' : 'neutral'}>{STATE_LABELS[copy.state] ?? copy.state}</Badge></td></tr>)}</tbody></table></div>}</Card>)}
      {record.holds.length > 0 && <Card className="p-5"><h3 className="mb-3 font-bold">Réservations actives</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Adhérent</th><th className="p-2">Statut</th><th className="p-2">Placée le</th></tr></thead><tbody>{record.holds.map(hold => <tr key={hold.id} className="border-b last:border-0"><td className="p-2">{hold.memberName}<span className="ml-2 text-xs text-slate-500">{hold.memberNumber}</span></td><td className="p-2 capitalize">{hold.state}</td><td className="p-2">{new Date(hold.placedAt).toLocaleDateString('fr-FR')}</td></tr>)}</tbody></table></div></Card>}
    </>}
      <Dialog open={editing} onOpenChange={(o) => { setEditing(o); if (!o) setActionError(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifier la notice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Titre</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1 text-xs rounded-xl h-9" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Sous-titre</label>
              <Input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} className="mt-1 text-xs rounded-xl h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Langue</label>
                <Input value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className="mt-1 text-xs rounded-xl h-9" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Année de parution</label>
                <Input type="number" value={form.publicationYear} onChange={e => setForm(f => ({ ...f, publicationYear: e.target.value }))} className="mt-1 text-xs rounded-xl h-9" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Résumé</label>
              <Textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} className="mt-1 text-xs rounded-xl" rows={3} />
            </div>
            {actionError && <p className="text-xs font-bold text-red-600">{actionError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Annuler</Button>
            <Button onClick={() => void saveEdit()} disabled={saving} className="bg-[#0066FF] hover:bg-[#0052CC] text-white">{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </div>;
}
