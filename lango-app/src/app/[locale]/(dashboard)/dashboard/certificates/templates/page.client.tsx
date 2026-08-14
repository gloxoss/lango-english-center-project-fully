'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layers, Plus, Search, RefreshCw, PenLine, Archive, Loader2 } from 'lucide-react';

type Template = {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
};

const STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'success' | 'warning' }> = {
  active: { label: 'Actif', variant: 'success' },
  draft: { label: 'Brouillon', variant: 'warning' },
  archived: { label: 'Archivé', variant: 'neutral' },
};

export default function CertificatesTemplatesPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<Template | null>(null);
  const [archiving, setArchiving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/certificates/templates').then(r => r.json());
      if (res.success) setTemplates(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return templates.filter(t =>
      (t.name?.toLowerCase().includes(q) ?? false) &&
      (statusFilter === 'all' || t.status === statusFilter)
    );
  }, [templates, search, statusFilter]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/certificates/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setCreateError(json.message || json.error?.message || 'Erreur lors de la création.');
        return;
      }
      setIsCreateOpen(false);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/certificates/templates/${archiveTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        alert(json.message || json.error?.message || 'Erreur lors de l\'archivage');
      }
      setArchiveTarget(null);
      await load();
    } finally {
      setArchiving(false);
    }
  };

  const activeCount = templates.filter(t => t.status === 'active').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Modèles de certificats</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Modèles visuels réutilisables, conçus avec l'éditeur de documents.</p>
          </div>
        </div>
        <Button onClick={() => { setName(''); setDescription(''); setCreateError(null); setIsCreateOpen(true); }} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer">
          <Plus className="w-4 h-4" /><span>Nouveau modèle</span>
        </Button>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{templates.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center"><Layers className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actifs</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{activeCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Layers className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Brouillons</span>
            <h3 className="text-2xl font-extrabold text-[#0EA5C4] mt-1">{templates.filter(t => t.status === 'draft').length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0EA5C4] flex items-center justify-center"><Layers className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Rechercher un modèle..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Tous les statuts</SelectItem>
              <SelectItem value="active" className="text-xs">Actif</SelectItem>
              <SelectItem value="draft" className="text-xs">Brouillon</SelectItem>
              <SelectItem value="archived" className="text-xs">Archivé</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-medium cursor-pointer" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Actualiser
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 pl-4">Nom</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Description</th>
                <th className="p-3">Créé le</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucun modèle trouvé.</td></tr>
              ) : (
                filtered.map(t => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3 pl-4 font-semibold text-slate-700">{t.name}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_BADGE[t.status]?.variant || 'neutral'}>
                        {STATUS_BADGE[t.status]?.label || t.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-500 max-w-[260px] truncate">{t.description || '-'}</td>
                    <td className="p-3 text-slate-500">{new Date(t.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="p-3 pr-4 text-right space-x-1.5 whitespace-nowrap">
                      {t.status !== 'archived' && (
                        <>
                          <Link
                            href={`/${locale}/dashboard/certificates/templates/${t.id}/edit`}
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                          >
                            <PenLine className="w-3.5 h-3.5 mr-1.5" />Concevoir
                          </Link>
                          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => setArchiveTarget(t)}>
                            <Archive className="w-3.5 h-3.5 mr-1.5" />Archiver
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nouveau modèle de certificat</DialogTitle>
            <DialogDescription>Le modèle visuel pourra être réutilisé comme base de conception.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Nom</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Diplôme de fin d'année" className="h-9 text-xs rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Description (optionnelle)</Label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]"
              />
            </div>
            {createError && <p className="text-xs font-semibold text-rose-600">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="text-xs h-9 cursor-pointer">Annuler</Button>
            <Button className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold gap-1.5 px-4 cursor-pointer" onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive dialog */}
      <Dialog open={archiveTarget !== null} onOpenChange={(o) => { if (!o && !archiving) setArchiveTarget(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Archiver le modèle</DialogTitle>
            <DialogDescription>« {archiveTarget?.name} » ne sera plus proposé à la conception.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)} className="text-xs h-9 cursor-pointer" disabled={archiving}>Annuler</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 font-bold gap-1.5 px-4 cursor-pointer" onClick={handleArchive} disabled={archiving}>
              {archiving && <Loader2 className="w-4 h-4 animate-spin" />}
              {archiving ? 'Archivage...' : 'Archiver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
