'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2, Pencil } from 'lucide-react';

type FeeStructure = {
  id: string;
  name: string;
  amount: string;
  description: string | null;
  isActive: boolean;
};

// ponytail: the real feeStructures table is a flat list of named pricing
// plans (name/amount/description/isActive) - no per-class rules, cycles,
// penalties, grace periods, or generated payment schedules exist in the
// schema (see the route's own comment). The prior mock invented all of
// that; scoped this page down to what's real instead, same call made for
// chart-of-accounts/bank-reconciliation/journal-explorer earlier.
export function PricingStructuresView({ locale: _locale }: { locale?: string } = {}) {
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeeStructure | null>(null);
  const [form, setForm] = useState({ name: '', amount: '', description: '', isActive: true });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/finance/fee-structures?pageSize=200')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setStructures(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', amount: '', description: '', isActive: true });
    setShowForm(true);
  };

  const openEdit = (fs: FeeStructure) => {
    setEditing(fs);
    setForm({ name: fs.name, amount: fs.amount, description: fs.description ?? '', isActive: fs.isActive });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.amount) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/finance/fee-structures', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing
          ? { id: editing.id, name: form.name, amount: Number(form.amount), description: form.description || undefined, isActive: form.isActive }
          : { name: form.name, amount: Number(form.amount), description: form.description || undefined, isActive: form.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        load();
      } else {
        console.error('API error saving fee structure', json.message);
      }
    } catch (err) {
      console.error('Failed to save fee structure', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/finance/fee-structures?id=${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      console.error('Failed to delete fee structure', err);
    }
  };

  const filtered = structures.filter(fs => fs.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Structures tarifaires</h1>
          <p className="text-xs text-slate-500 mt-1">{structures.length} structure(s) de frais réelle(s) pour cet établissement.</p>
        </div>
        <Button size="sm" onClick={openCreate} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Créer un type de frais
        </Button>
      </div>

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher un type de frais..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </Card>

      {showForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-extrabold text-[#16212B]">{editing ? 'Modifier le type de frais' : 'Nouveau type de frais'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Nom</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Montant (MAD)</label>
              <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Statut</label>
              <select value={form.isActive ? 'active' : 'inactive'} onChange={e => setForm({ ...form, isActive: e.target.value === 'active' })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
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
              <th className="py-3.5 px-4">Description</th>
              <th className="py-3.5 px-4 text-right">Montant</th>
              <th className="py-3.5 px-4 text-center">Statut</th>
              <th className="py-3.5 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-slate-400">Aucune structure de frais configurée.</td></tr>
            )}
            {filtered.map(fs => (
              <tr key={fs.id} className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3.5 px-4 font-bold text-[#16212B]">{fs.name}</td>
                <td className="py-3.5 px-4 text-slate-500">{fs.description ?? '—'}</td>
                <td className="py-3.5 px-4 text-right font-extrabold text-[#16212B]">{Number(fs.amount).toLocaleString('fr-FR')} MAD</td>
                <td className="py-3.5 px-4 text-center">
                  <Badge className={`text-[10px] border-none font-bold ${fs.isActive ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'}`}>
                    {fs.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(fs)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2487B8]">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(fs.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
