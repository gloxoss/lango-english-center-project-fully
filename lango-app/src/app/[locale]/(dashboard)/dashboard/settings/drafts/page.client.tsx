'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FilePlus2, Loader2, Send, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Draft = {
  id: string;
  key: string;
  branchId: string | null;
  title: string;
  reason: string | null;
  proposedValue: unknown;
  currentValue: unknown;
  baseVersion: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  authorId: string;
  approverId: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
};

type CatalogDef = {
  key: string;
  label: string;
  description: string | null;
  namespace: string;
  sensitivity: string;
  effective?: { value: unknown; source: string; version: number };
};

const STATUS_META: Record<Draft['status'], { label: string; cls: string }> = {
  draft: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'En attente', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  approved: { label: 'Approuvée', cls: 'bg-blue-50 text-blue-600 border border-blue-200' },
  rejected: { label: 'Rejetée', cls: 'bg-red-50 text-red-600 border border-red-200' },
  applied: { label: 'Appliquée', cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  cancelled: { label: 'Annulée', cls: 'bg-slate-100 text-slate-500' },
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '(vide)';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function parseValueInput(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  try { return JSON.parse(trimmed); } catch { return trimmed; }
}

export default function SettingsDraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [catalog, setCatalog] = useState<CatalogDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [tab, setTab] = useState('open');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ key: '', title: '', reason: '', value: '' });

  const [review, setReview] = useState<{ draft: Draft; action: 'approve' | 'reject' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [draftsRes, catalogRes] = await Promise.all([
        fetch('/api/settings/drafts'),
        fetch('/api/settings/catalog'),
      ]);
      const draftsJson = await draftsRes.json();
      const catalogJson = await catalogRes.json();
      if (draftsJson.success) setDrafts(draftsJson.data.drafts);
      if (catalogJson.success) setCatalog(catalogJson.data.definitions);
    } catch {
      setToast({ type: 'err', msg: 'Erreur de chargement.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const visible = useMemo(() => {
    if (tab === 'open') return drafts.filter(d => d.status === 'submitted' || d.status === 'draft');
    if (tab === 'done') return drafts.filter(d => ['approved', 'applied', 'rejected', 'cancelled'].includes(d.status));
    return drafts;
  }, [drafts, tab]);

  const selectedDef = catalog.find(c => c.key === form.key);
  const isComplex = selectedDef ? typeof selectedDef.effective?.value === 'object' && selectedDef.effective?.value !== null : false;

  const submit = async (path: string, init?: RequestInit) => {
    const res = await fetch(path, init);
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message ?? 'Erreur.');
    return json;
  };

  const handleCreate = async () => {
    if (!form.key || !form.title.trim()) {
      setToast({ type: 'err', msg: 'Clé et titre requis.' });
      return;
    }
    setCreating(true);
    try {
      await submit('/api/settings/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: form.key,
          title: form.title.trim(),
          reason: form.reason.trim() || undefined,
          proposedValue: parseValueInput(form.value),
        }),
      });
      setToast({ type: 'ok', msg: 'Proposition créée.' });
      setCreateOpen(false);
      setForm({ key: '', title: '', reason: '', value: '' });
      load();
    } catch (e) {
      setToast({ type: 'err', msg: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const act = async (id: string, action: 'submit' | 'cancel') => {
    setActingId(id);
    try {
      await submit(`/api/settings/drafts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setToast({ type: 'ok', msg: action === 'submit' ? 'Proposée pour approbation.' : 'Proposition annulée.' });
      load();
    } catch (e) {
      setToast({ type: 'err', msg: (e as Error).message });
    } finally {
      setActingId(null);
    }
  };

  const handleReview = async () => {
    if (!review) return;
    setReviewing(true);
    try {
      const path = review.action === 'approve'
        ? `/api/settings/drafts/${review.draft.id}/approve`
        : `/api/settings/drafts/${review.draft.id}/reject`;
      const body = review.action === 'approve' ? { comment: reviewNote || undefined } : { reason: reviewNote || undefined };
      await submit(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setToast({ type: 'ok', msg: review.action === 'approve' ? 'Proposée approuvée et appliquée.' : 'Proposée rejetée.' });
      setReview(null);
      setReviewNote('');
      load();
    } catch (e) {
      setToast({ type: 'err', msg: (e as Error).message });
    } finally {
      setReviewing(false);
    }
  };

  if (loading && drafts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Approbation des paramètres</h1>
          <p className="text-xs text-slate-500 mt-1">
            Proposez une modification, faites-la valider par un second administrateur (séparation des tâches).
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-2 h-9 rounded-full px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
        >
          <FilePlus2 className="w-4 h-4" />
          Nouvelle proposition
        </Button>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
          toast.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="open">En attente ({drafts.filter(d => d.status === 'submitted' || d.status === 'draft').length})</TabsTrigger>
          <TabsTrigger value="done">Traitées ({drafts.filter(d => !['submitted', 'draft'].includes(d.status)).length})</TabsTrigger>
          <TabsTrigger value="all">Tout ({drafts.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {visible.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm border border-dashed border-slate-200 rounded-2xl">
          Aucune proposition dans cette catégorie.
        </div>
      )}

      <div className="space-y-3">
        {visible.map(draft => {
          const meta = STATUS_META[draft.status];
          const def = catalog.find(c => c.key === draft.key);
          return (
            <Card key={draft.id} className="p-5 border border-slate-200 rounded-2xl shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-800 truncate">{draft.title}</h3>
                    <Badge variant="neutral" className={`text-[10px] px-2 ${meta.cls}`}>{meta.label}</Badge>
                    <span className="text-[10px] text-slate-400 font-mono">{draft.key}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{def?.label ?? draft.key}</p>
                  {draft.reason && <p className="text-xs text-slate-500 mt-1 italic">« {draft.reason} »</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {draft.status === 'draft' && (
                    <>
                      <Button size="sm" variant="outline" className="h-8 text-xs rounded-full gap-1.5" disabled={actingId === draft.id} onClick={() => act(draft.id, 'cancel')}>
                        Annuler
                      </Button>
                      <Button size="sm" className="h-8 text-xs rounded-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" disabled={actingId === draft.id} onClick={() => act(draft.id, 'submit')}>
                        <Send className="w-3.5 h-3.5" /> Soumettre
                      </Button>
                    </>
                  )}
                  {draft.status === 'submitted' && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs rounded-full gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setReviewNote(''); setReview({ draft, action: 'reject' }); }}>
                        <XCircle className="w-3.5 h-3.5" /> Rejeter
                      </Button>
                      <Button size="sm" className="h-8 text-xs rounded-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setReviewNote(''); setReview({ draft, action: 'approve' }); }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approuver
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Valeur actuelle</p>
                  <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap break-words">{formatValue(draft.currentValue)}</pre>
                  {draft.baseVersion > 0 && <p className="text-[10px] text-slate-400 mt-1">version de base v{draft.baseVersion}</p>}
                </div>
                <div className="bg-blue-50/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">Valeur proposée</p>
                  <pre className="text-xs font-mono text-blue-800 whitespace-pre-wrap break-words">{formatValue(draft.proposedValue)}</pre>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
                <span>Auteur: {draft.authorId.slice(0, 10)}</span>
                <span>Créée: {new Date(draft.createdAt).toLocaleString('fr-FR')}</span>
                {draft.approverId && <span>Décision: {draft.approverId.slice(0, 10)}</span>}
                {draft.rejectionReason && <span className="text-red-500">Motif: {draft.rejectionReason}</span>}
                {draft.appliedAt && <span>Appliquée: {new Date(draft.appliedAt).toLocaleString('fr-FR')}</span>}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create draft dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle proposition</DialogTitle>
            <DialogDescription>
              Décrivez la modification. Un second administrateur devra l&apos;approuver avant son application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Paramètre</Label>
              <Select value={form.key} onValueChange={k => setForm(f => ({ ...f, key: k, value: '' }))}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Choisir un paramètre" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.label} — {c.key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedDef && (
              <p className="text-[10px] text-slate-500">{selectedDef.description ?? selectedDef.key}</p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Titre</Label>
              <Input className="h-9 text-xs rounded-xl" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Mettre à jour l'année scolaire" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nouvelle valeur</Label>
              <Textarea
                className="text-xs font-mono rounded-xl resize-y"
                rows={3}
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder={isComplex ? 'Saisir la valeur JSON' : selectedDef ? `Valeur actuelle: ${formatValue(selectedDef.effective?.value)}` : ''}
              />
              {selectedDef?.effective && (
                <p className="text-[10px] text-slate-400">Actuelle: {formatValue(selectedDef.effective.value)} (source {selectedDef.effective.source})</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Motif (optionnel)</Label>
              <Input className="h-9 text-xs rounded-xl" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Pourquoi cette modification ?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9 text-xs rounded-full" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button className="h-9 text-xs rounded-full bg-blue-600 hover:bg-blue-700 text-white" disabled={creating} onClick={handleCreate}>
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Créer la proposition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve / reject dialog */}
      <Dialog open={review !== null} onOpenChange={o => !o && setReview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{review?.action === 'approve' ? 'Approuver et appliquer' : 'Rejeter la proposition'}</DialogTitle>
            <DialogDescription>
              {review?.draft.title} — {review?.draft.key}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Valeur proposée</p>
              <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">{review ? formatValue(review.draft.proposedValue) : ''}</pre>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">{review?.action === 'approve' ? 'Commentaire (optionnel)' : 'Motif du rejet'}</Label>
              <Textarea className="text-xs rounded-xl resize-y" rows={2} value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9 text-xs rounded-full" onClick={() => setReview(null)}>Annuler</Button>
            <Button
              className={`h-9 text-xs rounded-full text-white ${review?.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
              disabled={reviewing}
              onClick={handleReview}
            >
              {reviewing && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              {review?.action === 'approve' ? 'Approuver & appliquer' : 'Rejeter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
