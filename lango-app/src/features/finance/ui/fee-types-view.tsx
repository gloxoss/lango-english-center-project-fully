'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Pencil, Archive } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type FeeType = {
  id: string;
  name: string;
  description: string | null;
  code: string | null;
  taxable: boolean;
  refundable: boolean;
  discountable: boolean;
  fineable: boolean;
  revenueAccountId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isArchived: boolean;
};

type Account = { id: string; code: string; name: string };

type FormState = {
  name: string;
  description: string;
  code: string;
  taxable: boolean;
  refundable: boolean;
  discountable: boolean;
  fineable: boolean;
  revenueAccountId: string;
  effectiveFrom: string;
  effectiveTo: string;
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  code: '',
  taxable: false,
  refundable: true,
  discountable: true,
  fineable: false,
  revenueAccountId: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '',
});

// Fee types — tenant-scoped fee_categories (Fees Type screen). Types are
// renamed/re-described or archived, never deleted, because fee components
// reference them. Phase B: code, tax/refund/discount/fine flags, revenue
// account mapping and active dates.
export function FeeTypesView() {
  const { role } = usePermissions();
  const canManage = role === 'school_admin' || role === 'accountant';
  const [types, setTypes] = useState<FeeType[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeeType | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/finance/fee-types')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) setTypes(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch('/api/finance/accounting/accounts?pageSize=100')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) setAccounts(json.data ?? []);
      })
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setShowForm(true);
  };

  const openEdit = (t: FeeType) => {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description ?? '',
      code: t.code ?? '',
      taxable: t.taxable,
      refundable: t.refundable,
      discountable: t.discountable,
      fineable: t.fineable,
      revenueAccountId: t.revenueAccountId ?? '',
      effectiveFrom: t.effectiveFrom,
      effectiveTo: t.effectiveTo ?? '',
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        code: form.code.trim() || null,
        taxable: form.taxable,
        refundable: form.refundable,
        discountable: form.discountable,
        fineable: form.fineable,
        revenueAccountId: form.revenueAccountId || null,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
      };
      const res = await fetch('/api/finance/fee-types', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        load();
      } else {
        setError(json.message ?? json.error?.message ?? "Échec de l'enregistrement.");
      }
    } catch (err) {
      setError("Erreur réseau lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (t: FeeType) => {
    if (!window.confirm(`Archiver le type de frais « ${t.name} » ? Il restera dans l'historique.`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/fee-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, isArchived: true }),
      });
      const json = await res.json();
      if (json.success) load();
      else window.alert(json.message ?? "Échec de l'archivage.");
    } catch {
      window.alert("Erreur réseau lors de l'archivage.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = types
    .filter(t => (showArchived ? t.isArchived : !t.isArchived))
    .filter(t => `${t.name} ${t.code ?? ''} ${t.description ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  const accountLabel = (id: string | null) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? `${acc.code} — ${acc.name}` : '—';
  };

  const Flag = ({ on, label, off }: { on: boolean; label: string; off: string }) => (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold ${on ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-400'}`}>
      {on ? label : off}
    </span>
  );

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Types de frais</h1>
          <p className="text-xs text-slate-500 mt-1">{types.filter(t => !t.isArchived).length} type(s) actif(s) pour cet établissement.</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Créer un type de frais
          </Button>
        )}
      </div>

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher un type de frais..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="rounded" />
          Voir les archivés
        </label>
      </Card>

      {canManage && showForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-extrabold text-[#16212B]">{editing ? 'Modifier le type de frais' : 'Nouveau type de frais'}</h3>
          {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Nom</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Code (optionnel, unique)</label>
              <Input value={form.code} placeholder="ex. SCOLARITE" onChange={e => setForm({ ...form, code: e.target.value })} className="h-9 rounded-xl uppercase" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Description (optionnel)</label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-9 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {([
              ['taxable', 'Imposable (TVA)', form.taxable],
              ['refundable', 'Remboursable', form.refundable],
              ['discountable', 'Réductible', form.discountable],
              ['fineable', 'Soumis à pénalité', form.fineable],
            ] as const).map(([key, label, value]) => (
              <label key={key} className="flex items-center gap-2 font-bold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={value} onChange={e => setForm({ ...form, [key]: e.target.checked })} className="rounded" />
                {label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Compte de produits (optionnel)</label>
              <select value={form.revenueAccountId} onChange={e => setForm({ ...form, revenueAccountId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs">
                <option value="">— Aucun —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Début d&apos;effet</label>
              <Input type="date" value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Fin d&apos;effet (optionnel)</label>
              <Input type="date" value={form.effectiveTo} onChange={e => setForm({ ...form, effectiveTo: e.target.value })} className="h-9 rounded-xl" />
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
              <th className="py-3.5 px-4">Code</th>
              <th className="py-3.5 px-4">Nom</th>
              <th className="py-3.5 px-4">Description</th>
              <th className="py-3.5 px-4">Règles</th>
              <th className="py-3.5 px-4">Compte produits</th>
              <th className="py-3.5 px-4 text-center">Statut</th>
              {canManage && <th className="py-3.5 px-4" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={canManage ? 7 : 6} className="py-8 text-center text-slate-400">Aucun type de frais {showArchived ? 'archivé' : 'actif'}.</td></tr>
            )}
            {filtered.map(t => (
              <tr key={t.id} className={`hover:bg-slate-50/80 transition font-medium ${t.isArchived ? 'opacity-50' : ''}`}>
                <td className="py-3.5 px-4 font-mono text-[11px] text-[#2487B8]">{t.code ?? '—'}</td>
                <td className="py-3.5 px-4 font-bold text-[#16212B]">{t.name}</td>
                <td className="py-3.5 px-4 text-slate-500 max-w-[220px] truncate">{t.description ?? '—'}</td>
                <td className="py-3.5 px-4">
                  <div className="flex flex-wrap gap-1">
                    <Flag on={t.taxable} label="Imposable" off="Non imposable" />
                    <Flag on={t.refundable} label="Remboursable" off="Non remb." />
                    <Flag on={t.discountable} label="Réductible" off="Non réductible" />
                    <Flag on={t.fineable} label="Pénalisable" off="Sans pénalité" />
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-500">{accountLabel(t.revenueAccountId)}</td>
                <td className="py-3.5 px-4 text-center">
                  <Badge className={`text-[10px] border-none font-bold ${t.isArchived ? 'bg-slate-100 text-slate-500' : 'bg-[#DDF5EC] text-[#17A673]'}`}>
                    {t.isArchived ? 'Archivé' : 'Actif'}
                  </Badge>
                </td>
                {canManage && (
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1">
                      {!t.isArchived && (
                        <>
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2487B8]" title="Modifier">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleArchive(t)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Archiver">
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
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
