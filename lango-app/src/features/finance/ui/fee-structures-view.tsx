'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, History, X, Plus, Loader2, Pencil } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type FeeStructure = {
  id: string;
  name: string;
  amount: string;
  description: string | null;
  isActive: boolean;
  academicTermId: string | null;
  branchId: string | null;
};

type Version = {
  id: string;
  versionNumber: number;
  status: 'draft' | 'published';
  effectiveFrom: string | null;
  publishedAt: string | null;
  componentsSnapshot: {
    name: string;
    amount: string;
    mandatory?: boolean;
    recurrence?: 'once' | 'term' | 'yearly';
    taxable?: boolean;
    dueOffsetDays?: number;
  }[] | null;
};

type Recurrence = 'once' | 'term' | 'yearly';
type ComponentRow = { name: string; amount: string; recurrence: Recurrence; taxable: boolean; mandatory: boolean; dueOffsetDays: number };

type NamedScope = { id: string; name: string; code?: string | null };

type StructForm = {
  name: string;
  description: string;
  amount: string;
  academicTermId: string;
  branchId: string;
  isActive: boolean;
};

const emptyStructForm = (): StructForm => ({ name: '', description: '', amount: '', academicTermId: '', branchId: '', isActive: true });

const emptyComponent = (): ComponentRow => ({ name: '', amount: '', recurrence: 'once', taxable: false, mandatory: true, dueOffsetDays: 0 });

const recurrenceLabel: Record<Recurrence, string> = { once: 'Une fois', term: 'Par trimestre', yearly: 'Annuel' };

// Fee structures — tenant-scoped feeStructures (Fees Group screen). Each
// structure can be scoped to an academic term + branch, and carries immutable
// versioned snapshots of its fee components (recurrence / tax / due offset).
// Structure create/edit is a school_admin action (POST/PUT require that role);
// version authoring is open to accountants too.
export function FeeStructuresView() {
  const { role } = usePermissions();
  const canManage = role === 'school_admin' || role === 'accountant';
  const canEditStructure = role === 'school_admin';
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [terms, setTerms] = useState<NamedScope[]>([]);
  const [branches, setBranches] = useState<NamedScope[]>([]);
  const [selected, setSelected] = useState<FeeStructure | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [publish, setPublish] = useState(false);
  const [components, setComponents] = useState<ComponentRow[]>([emptyComponent()]);
  const [showStructureForm, setShowStructureForm] = useState(false);
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
  const [structForm, setStructForm] = useState<StructForm>(emptyStructForm());
  const [structError, setStructError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/finance/fee-structures?pageSize=200')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) setStructures(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch('/api/academics/semesters?pageSize=200')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) setTerms(json.data ?? []);
      })
      .catch(() => {});
    fetch('/api/settings/branches')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) setBranches(json.data ?? []);
      })
      .catch(() => {});
  }, []);

  const openCreateStructure = () => {
    setEditingStructure(null);
    setStructForm(emptyStructForm());
    setStructError(null);
    setShowStructureForm(true);
  };

  const openEditStructure = (fs: FeeStructure) => {
    setEditingStructure(fs);
    setStructForm({
      name: fs.name,
      description: fs.description ?? '',
      amount: String(fs.amount),
      academicTermId: fs.academicTermId ?? '',
      branchId: fs.branchId ?? '',
      isActive: fs.isActive,
    });
    setStructError(null);
    setShowStructureForm(true);
  };

  const handleSaveStructure = async () => {
    if (!structForm.name.trim() || structForm.amount === '') return;
    setSaving(true);
    setStructError(null);
    try {
      const payload = {
        name: structForm.name.trim(),
        description: structForm.description.trim() || undefined,
        amount: structForm.amount,
        academicTermId: structForm.academicTermId || null,
        branchId: structForm.branchId || null,
        isActive: structForm.isActive,
      };
      const res = await fetch('/api/finance/fee-structures', {
        method: editingStructure ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingStructure ? { id: editingStructure.id, ...payload } : payload),
      });
      const json = await res.json();
      if (json.success) {
        setShowStructureForm(false);
        load();
      } else {
        setStructError(json.message ?? json.error?.message ?? "Échec de l'enregistrement.");
      }
    } catch (err) {
      setStructError("Erreur réseau lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const openVersions = async (fs: FeeStructure) => {
    setSelected(fs);
    setVersions([]);
    setVersionsLoading(true);
    setShowVersionForm(false);
    try {
      const res = await fetch(`/api/finance/fee-structures/${fs.id}/versions`);
      const json = await res.json();
      if (json?.success) setVersions(json.data.versions ?? []);
    } catch {
      // keep empty history
    } finally {
      setVersionsLoading(false);
    }
  };

  const closeVersions = () => {
    setSelected(null);
    setVersions([]);
  };

  const resetVersionForm = () => {
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setPublish(false);
    setComponents([emptyComponent()]);
  };

  const handleCreateVersion = async () => {
    const snapshot = components
      .filter(c => c.name.trim() && c.amount !== '')
      .map(c => ({ name: c.name.trim(), amount: c.amount.trim(), recurrence: c.recurrence, taxable: c.taxable, mandatory: c.mandatory, dueOffsetDays: c.dueOffsetDays }));
    if (!selected || snapshot.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/finance/fee-structures/${selected.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ componentsSnapshot: snapshot, effectiveFrom, status: publish ? 'published' : 'draft' }),
      });
      const json = await res.json();
      if (json.success) {
        setShowVersionForm(false);
        openVersions(selected);
      } else {
        console.error('API error creating version', json.message);
      }
    } catch (err) {
      console.error('Failed to create version', err);
    } finally {
      setSaving(false);
    }
  };

  const filtered = structures.filter(fs => `${fs.name} ${fs.description ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  const termLabel = (id: string | null) => {
    const t = terms.find(t => t.id === id);
    return t ? t.name : '—';
  };

  const branchLabel = (id: string | null) => {
    const b = branches.find(b => b.id === id);
    return b ? `${b.code ?? ''} ${b.name}`.trim() : '—';
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Structures de frais</h1>
          <p className="text-xs text-slate-500 mt-1">{structures.length} structure(s) réelle(s) — les versions publiées sont immuables.</p>
        </div>
        {canEditStructure && (
          <Button size="sm" onClick={openCreateStructure} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nouvelle structure
          </Button>
        )}
      </div>

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher une structure..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </Card>

      {canEditStructure && showStructureForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-extrabold text-[#16212B]">{editingStructure ? 'Modifier la structure de frais' : 'Nouvelle structure de frais'}</h3>
          {structError && <p className="text-[11px] font-bold text-rose-600">{structError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Nom</label>
              <Input value={structForm.name} onChange={e => setStructForm({ ...structForm, name: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Montant</label>
              <Input type="number" step="0.01" min="0" placeholder="ex. 1500" value={structForm.amount} onChange={e => setStructForm({ ...structForm, amount: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Description (optionnel)</label>
              <Input value={structForm.description} onChange={e => setStructForm({ ...structForm, description: e.target.value })} className="h-9 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Trimestre (optionnel)</label>
              <select value={structForm.academicTermId} onChange={e => setStructForm({ ...structForm, academicTermId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="">— Tous —</option>
                {terms.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Branche (optionnel)</label>
              <select value={structForm.branchId} onChange={e => setStructForm({ ...structForm, branchId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="">— Toutes —</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.code ? `${b.code} — ` : ''}{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Statut</label>
              <select value={structForm.isActive ? 'yes' : 'no'} onChange={e => setStructForm({ ...structForm, isActive: e.target.value === 'yes' })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="yes">Active</option>
                <option value="no">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={handleSaveStructure} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowStructureForm(false)} className="h-9 rounded-xl text-xs font-bold">
              Annuler
            </Button>
          </div>
        </Card>
      )}

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
            <tr>
              <th className="py-3.5 px-4">Nom</th>
              <th className="py-3.5 px-4">Description</th>
              <th className="py-3.5 px-4">Portée</th>
              <th className="py-3.5 px-4 text-right">Montant</th>
              <th className="py-3.5 px-4 text-center">Statut</th>
              <th className="py-3.5 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">Aucune structure de frais configurée.</td></tr>
            )}
            {filtered.map(fs => (
              <tr key={fs.id} className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3.5 px-4 font-bold text-[#16212B]">{fs.name}</td>
                <td className="py-3.5 px-4 text-slate-500 max-w-[220px] truncate">{fs.description ?? '—'}</td>
                <td className="py-3.5 px-4 text-slate-500">
                  <div className="flex flex-wrap gap-1">
                    {fs.academicTermId && <span className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">{termLabel(fs.academicTermId)}</span>}
                    {fs.branchId && <span className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">{branchLabel(fs.branchId)}</span>}
                    {!fs.academicTermId && !fs.branchId && <span className="text-slate-400">—</span>}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right font-extrabold text-[#16212B]">{Number(fs.amount).toLocaleString('fr-FR')} MAD</td>
                <td className="py-3.5 px-4 text-center">
                  <Badge className={`text-[10px] border-none font-bold ${fs.isActive ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'}`}>
                    {fs.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center justify-end gap-1">
                    {canEditStructure && (
                      <button onClick={() => openEditStructure(fs)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2487B8]" title="Modifier">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => openVersions(fs)} className="inline-flex items-center gap-1 p-1.5 rounded-lg text-[#2487B8] hover:bg-[#2487B8]/10 text-[11px] font-bold">
                      <History className="w-3.5 h-3.5" />
                      Versions
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {selected && (
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-extrabold text-[#16212B]">Versions — {selected.name}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Snapshots immuables des composants de frais.</p>
            </div>
            <div className="flex items-center gap-2">
              {canManage && (
                <Button size="sm" onClick={() => { setShowVersionForm(v => !v); if (!showVersionForm) resetVersionForm(); }} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Nouvelle version
                </Button>
              )}
              <button onClick={closeVersions} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {canManage && showVersionForm && (
            <div className="p-5 border-b border-slate-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Début d&apos;effet</label>
                  <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="h-9 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Publier immédiatement</label>
                  <select value={publish ? 'yes' : 'no'} onChange={e => setPublish(e.target.value === 'yes')} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                    <option value="no">Brouillon</option>
                    <option value="yes">Publier</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                {components.map((c, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_150px_110px_70px_90px_32px] gap-2 items-center text-xs">
                    <Input placeholder="Nom du composant (ex. Scolarité)" value={c.name} onChange={e => updateComponent(i, { name: e.target.value })} className="h-9 rounded-xl" />
                    <Input type="number" placeholder="Montant" value={c.amount} onChange={e => updateComponent(i, { amount: e.target.value })} className="h-9 rounded-xl" />
                    <select value={c.recurrence} onChange={e => updateComponent(i, { recurrence: e.target.value as Recurrence })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                      <option value="once">Une fois</option>
                      <option value="term">Par trimestre</option>
                      <option value="yearly">Annuel</option>
                    </select>
                    <select value={c.mandatory ? 'yes' : 'no'} onChange={e => updateComponent(i, { mandatory: e.target.value === 'yes' })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                      <option value="yes">Obligatoire</option>
                      <option value="no">Optionnel</option>
                    </select>
                    <label className="flex items-center justify-center gap-1.5 font-bold text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={c.taxable} onChange={e => updateComponent(i, { taxable: e.target.checked })} className="rounded" />
                      TVA
                    </label>
                    <Input type="number" min="0" max="3650" placeholder="Éch. (j)" title="Décalage d'échéance en jours" value={c.dueOffsetDays} onChange={e => updateComponent(i, { dueOffsetDays: Number(e.target.value) || 0 })} className="h-9 rounded-xl" />
                    <button onClick={() => removeComponent(i)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setComponents([...components, emptyComponent()])} className="h-9 rounded-xl text-xs font-bold gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter un composant
                </Button>
                <Button size="sm" disabled={saving} onClick={handleCreateVersion} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Créer la version
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {versionsLoading && <div className="p-6 text-center text-xs text-slate-400">Chargement des versions...</div>}
            {!versionsLoading && versions.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">Aucune version créée pour cette structure.</div>
            )}
            {versions.map(v => (
              <div key={v.id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[#16212B]">Version {v.versionNumber}</span>
                    <Badge className={`text-[10px] border-none font-bold ${v.status === 'published' ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-amber-100 text-amber-700'}`}>
                      {v.status === 'published' ? 'Publiée' : 'Brouillon'}
                    </Badge>
                    {v.effectiveFrom && <span className="text-[10px] text-slate-400">Effet {v.effectiveFrom}</span>}
                  </div>
                  {v.componentsSnapshot && v.componentsSnapshot.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {v.componentsSnapshot.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600">
                          {c.name}
                          <span className="text-[#2487B8]">{Number(c.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                          {c.mandatory !== false && <span className="text-slate-400 font-medium">· oblig.</span>}
                          {c.recurrence === 'term' && <span className="text-slate-400">· trim.</span>}
                          {c.recurrence === 'yearly' && <span className="text-slate-400">· annuel</span>}
                          {c.taxable && <span className="text-[#B45309]">· TVA</span>}
                          {typeof c.dueOffsetDays === 'number' && c.dueOffsetDays > 0 && <span className="text-slate-400">· éch. +{c.dueOffsetDays} j</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {v.publishedAt && <span className="text-[10px] text-slate-400 shrink-0">Publiée le {new Date(v.publishedAt).toLocaleDateString('fr-FR')}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );

  function updateComponent(i: number, patch: Partial<ComponentRow>) {
    setComponents(prev => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function removeComponent(i: number) {
    setComponents(prev => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }
}
