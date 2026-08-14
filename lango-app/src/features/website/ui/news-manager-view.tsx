'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Newspaper, Plus, Trash2, Upload } from 'lucide-react';

type NewsStatus = 'draft' | 'published';

type NewsItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  body: string | null;
  status: NewsStatus;
  publishedAt: string | null;
  createdAt: string;
};

const EMPTY_FORM = {
  title: '', slug: '', excerpt: '', coverImageUrl: '', body: '', status: 'draft' as NewsStatus, publishedAt: '',
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function NewsManagerView() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => fetch('/api/settings/website/news')
    .then(r => r.json())
    .then((j) => { if (j.success) setItems(j.data); });

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setDialogOpen(true);
  };

  const openEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      slug: item.slug,
      excerpt: item.excerpt ?? '',
      coverImageUrl: item.coverImageUrl ?? '',
      body: item.body ?? '',
      status: item.status,
      publishedAt: item.publishedAt ? item.publishedAt.slice(0, 16) : '',
    });
    setSlugTouched(true);
    setDialogOpen(true);
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/settings/website/images', { method: 'POST', body: fd });
      const j = await res.json();
      if (!j.success) throw new Error(j.error?.message ?? 'Échec du téléversement');
      setForm(f => ({ ...f, coverImageUrl: j.data.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        excerpt: form.excerpt.trim() || null,
        coverImageUrl: form.coverImageUrl.trim() || null,
        body: form.body.trim() || null,
        status: form.status,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
      };
      const res = await fetch(editingId ? `/api/settings/website/news/${editingId}` : '/api/settings/website/news', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error?.message ?? 'Échec de l\'enregistrement');
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer cette actualité ?')) return;
    const res = await fetch(`/api/settings/website/news/${id}`, { method: 'DELETE' });
    const j = await res.json();
    if (j.success) load();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Newspaper className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Site Web — Actualités</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Liste et détail des actualités du site public de l&apos;école.</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer">
          <Plus className="w-4 h-4" /><span>Nouvelle actualité</span>
        </Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl p-3">{error}</div>}

      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <th className="pb-2">Titre</th>
              <th className="pb-2">Slug</th>
              <th className="pb-2">Statut</th>
              <th className="pb-2">Publication</th>
              <th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-slate-400 italic">Aucune actualité.</td></tr>
            )}
            {items.map(item => (
              <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => openEdit(item)}>
                <td className="py-3 font-bold text-[#16212B]">{item.title}</td>
                <td className="py-3 text-slate-500 font-mono">{item.slug}</td>
                <td className="py-3"><Badge variant={item.status === 'published' ? 'success' : 'neutral'}>{item.status === 'published' ? 'Publiée' : 'Brouillon'}</Badge></td>
                <td className="py-3 text-slate-500">{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="py-3 text-right">
                  <button type="button" onClick={(e) => { e.stopPropagation(); remove(item.id); }} className="text-slate-400 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier l\'actualité' : 'Nouvelle actualité'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Titre</Label>
              <Input
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setForm(f => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
                }}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => { setSlugTouched(true); setForm(f => ({ ...f, slug: slugify(e.target.value) })); }}
                className="text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Extrait</Label>
              <Textarea value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} rows={2} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Image de couverture</Label>
              <div className="flex items-center gap-3">
                <Input value={form.coverImageUrl} onChange={e => setForm(f => ({ ...f, coverImageUrl: e.target.value }))} placeholder="URL de l'image" className="text-sm flex-1" />
                <label className="shrink-0">
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
                  />
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 cursor-pointer hover:bg-slate-50">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Téléverser
                  </span>
                </label>
              </div>
              {form.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.coverImageUrl} alt="Aperçu" className="mt-2 h-24 rounded-lg border border-slate-200 object-cover" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Contenu</Label>
              <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={8} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Statut</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as NewsStatus }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="published">Publiée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Date de publication</Label>
                <Input type="datetime-local" value={form.publishedAt} onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))} className="text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-xs font-bold rounded-xl cursor-pointer">Annuler</Button>
            <Button onClick={save} disabled={saving || !form.title.trim() || !form.slug.trim()} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl cursor-pointer">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
