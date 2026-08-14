'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Pencil, Play, Loader2 } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type FinePolicy = {
  id: string;
  name: string;
  description: string | null;
  graceDays: number;
  formula: 'flat' | 'per_day' | 'tiered';
  flatAmount: number;
  perDayAmount: number;
  maxAmount: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'active' | 'archived';
};

const formulaLabel: Record<FinePolicy['formula'], string> = {
  flat: 'Forfait',
  per_day: 'Par jour',
  tiered: 'Par paliers',
};

export function FinePoliciesView() {
  const { role } = usePermissions();
  const canManage = role === 'school_admin' || role === 'accountant';
  const [policies, setPolicies] = useState<FinePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FinePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    graceDays: '0',
    formula: 'flat' as FinePolicy['formula'],
    flatAmount: '',
    perDayAmount: '',
    maxAmount: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    status: 'active' as FinePolicy['status'],
  });

  const load = () => {
    setLoading(true);
    fetch('/api/finance/fine-policies')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) setPolicies(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      description: '',
      graceDays: '0',
      formula: 'flat',
      flatAmount: '',
      perDayAmount: '',
      maxAmount: '',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
      status: 'active',
    });
    setShowForm(true);
  };

  const openEdit = (p: FinePolicy) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? '',
      graceDays: String(p.graceDays),
      formula: p.formula,
      flatAmount: String(p.flatAmount),
      perDayAmount: String(p.perDayAmount),
      maxAmount: p.maxAmount != null ? String(p.maxAmount) : '',
      effectiveFrom: p.effectiveFrom,
      effectiveTo: p.effectiveTo ?? '',
      status: p.status,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.flatAmount) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        graceDays: Number(form.graceDays) || 0,
        formula: form.formula,
        flatAmount: Number(form.flatAmount),
        perDayAmount: Number(form.perDayAmount) || 0,
        maxAmount: form.maxAmount ? Number(form.maxAmount) : undefined,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        status: form.status,
      };
      const res = await fetch('/api/finance/fine-policies', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        load();
      } else {
        console.error('API error saving fine policy', json.message);
      }
    } catch (err) {
      console.error('Failed to save fine policy', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/finance/fine-runs', { method: 'POST' });
      const json = await res.json();
      setRunResult(json?.message ?? (json?.success ? 'Évaluation terminée.' : 'Échec de l\'évaluation.'));
      if (json?.success) load();
    } catch (err) {
      setRunResult('Erreur réseau pendant l\'évaluation.');
    } finally {
      setRunning(false);
    }
  };

  const filtered = policies.filter(p => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Politiques d&apos;amendes</h1>
          <p className="text-xs text-slate-500 mt-1">{policies.length} politique(s) de pénalité de retard.</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={running} onClick={handleRun} className="h-9 text-xs rounded-xl gap-1.5 font-bold">
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Évaluation...' : 'Lancer l\'évaluation'}
            </Button>
            <Button size="sm" onClick={openCreate} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Nouvelle politique
            </Button>
          </div>
        )}
      </div>

      {runResult && (
        <Card className="p-3 bg-[#F6F9FC] rounded-2xl border border-[#2487B8]/20 text-xs font-bold text-[#16212B]">
          {runResult}
        </Card>
      )}

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher une politique..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </Card>

      {canManage && showForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-extrabold text-[#16212B]">{editing ? 'Modifier la politique' : 'Nouvelle politique d\'amende'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Nom</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Formule</label>
              <select value={form.formula} onChange={e => setForm({ ...form, formula: e.target.value as FinePolicy['formula'] })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="flat">Forfait</option>
                <option value="per_day">Par jour</option>
                <option value="tiered">Par paliers</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Jours de grâce</label>
              <Input type="number" value={form.graceDays} onChange={e => setForm({ ...form, graceDays: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Montant forfait (MAD)</label>
              <Input type="number" value={form.flatAmount} onChange={e => setForm({ ...form, flatAmount: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Par jour (MAD)</label>
              <Input type="number" value={form.perDayAmount} onChange={e => setForm({ ...form, perDayAmount: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Plafond (MAD, optionnel)</label>
              <Input type="number" value={form.maxAmount} onChange={e => setForm({ ...form, maxAmount: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Début d&apos;effet</label>
              <Input type="date" value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Fin d&apos;effet (optionnel)</label>
              <Input type="date" value={form.effectiveTo} onChange={e => setForm({ ...form, effectiveTo: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Statut</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as FinePolicy['status'] })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="active">Active</option>
                <option value="archived">Archivée</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-3">
              <label className="font-bold text-slate-600">Description (optionnel)</label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-9 rounded-xl" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={handleSave} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-9 rounded-xl text-xs font-bold">
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
              <th className="py-3.5 px-4">Formule</th>
              <th className="py-3.5 px-4 text-right">Forfait</th>
              <th className="py-3.5 px-4 text-right">Par jour</th>
              <th className="py-3.5 px-4 text-right">Plafond</th>
              <th className="py-3.5 px-4 text-center">Grâce</th>
              <th className="py-3.5 px-4 text-center">Statut</th>
              {canManage && <th className="py-3.5 px-4" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={canManage ? 8 : 7} className="py-8 text-center text-slate-400">Aucune politique d&apos;amende configurée.</td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3.5 px-4 font-bold text-[#16212B]">
                  {p.name}
                  <div className="text-[10px] font-medium text-slate-400">{p.description ?? '—'}</div>
                </td>
                <td className="py-3.5 px-4 text-slate-500">{formulaLabel[p.formula]}</td>
                <td className="py-3.5 px-4 text-right font-extrabold text-[#16212B]">{p.flatAmount.toFixed(2)} MAD</td>
                <td className="py-3.5 px-4 text-right text-slate-500">{p.perDayAmount.toFixed(2)} MAD</td>
                <td className="py-3.5 px-4 text-right text-slate-500">{p.maxAmount != null ? `${p.maxAmount.toFixed(2)} MAD` : '—'}</td>
                <td className="py-3.5 px-4 text-center text-slate-500">{p.graceDays} j</td>
                <td className="py-3.5 px-4 text-center">
                  <Badge className={`text-[10px] border-none font-bold ${p.status === 'active' ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'}`}>
                    {p.status === 'active' ? 'Active' : 'Archivée'}
                  </Badge>
                </td>
                {canManage && (
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2487B8]">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
