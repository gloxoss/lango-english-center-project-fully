'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Pencil } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type PaymentMethod = {
  id: string;
  methodCode: string;
  labelFr: string;
  labelAr: string | null;
  requiresReference: boolean;
  requiresBank: boolean;
  requiresDate: boolean;
  requiresProof: boolean;
  refundable: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
};

// Payment methods — configurable payment_method_configurations (Payment Type
// screen). Provider-backed online methods remain integrations; these are the
// offline method definitions with required-proof flags.
export function PaymentMethodsView() {
  const { role } = usePermissions();
  const canManage = role === 'school_admin' || role === 'accountant';
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    methodCode: '',
    labelFr: '',
    labelAr: '',
    requiresReference: false,
    requiresBank: false,
    requiresDate: false,
    requiresProof: false,
    refundable: true,
    isActive: true,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
  });

  const load = () => {
    setLoading(true);
    fetch('/api/finance/payment-methods')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) setMethods(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setForm({
      methodCode: '',
      labelFr: '',
      labelAr: '',
      requiresReference: false,
      requiresBank: false,
      requiresDate: false,
      requiresProof: false,
      refundable: true,
      isActive: true,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
    });
    setShowForm(true);
  };

  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setError(null);
    setForm({
      methodCode: m.methodCode,
      labelFr: m.labelFr,
      labelAr: m.labelAr ?? '',
      requiresReference: m.requiresReference,
      requiresBank: m.requiresBank,
      requiresDate: m.requiresDate,
      requiresProof: m.requiresProof,
      refundable: m.refundable,
      isActive: m.isActive,
      effectiveFrom: m.effectiveFrom,
      effectiveTo: m.effectiveTo ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.methodCode || !form.labelFr) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        methodCode: form.methodCode,
        labelFr: form.labelFr,
        labelAr: form.labelAr || undefined,
        requiresReference: form.requiresReference,
        requiresBank: form.requiresBank,
        requiresDate: form.requiresDate,
        requiresProof: form.requiresProof,
        refundable: form.refundable,
        isActive: form.isActive,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
      };
      const res = await fetch('/api/finance/payment-methods', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        load();
      } else {
        setError(json.message ?? 'Erreur inconnue.');
      }
    } catch (err) {
      setError('Erreur réseau pendant l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = methods.filter(m => `${m.methodCode} ${m.labelFr} ${m.labelAr ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  const Flag = ({ on, label }: { on: boolean; label: string }) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${on ? 'bg-[#2487B8]/10 text-[#2487B8]' : 'bg-slate-100 text-slate-400'}`}>
      {label}
    </span>
  );

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Méthodes de paiement</h1>
          <p className="text-xs text-slate-500 mt-1">{methods.length} méthode(s) de paiement configurée(s).</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nouvelle méthode
          </Button>
        )}
      </div>

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher une méthode..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </Card>

      {canManage && showForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-extrabold text-[#16212B]">{editing ? 'Modifier la méthode' : 'Nouvelle méthode de paiement'}</h3>
          {error && <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Code</label>
              <Input value={form.methodCode} disabled={!!editing} onChange={e => setForm({ ...form, methodCode: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Libellé (FR)</label>
              <Input value={form.labelFr} onChange={e => setForm({ ...form, labelFr: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Libellé (AR, optionnel)</label>
              <Input value={form.labelAr} onChange={e => setForm({ ...form, labelAr: e.target.value })} className="h-9 rounded-xl" />
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {([
              ['requiresReference', 'Référence requise'],
              ['requiresBank', 'Banque requise'],
              ['requiresDate', 'Date requise'],
              ['requiresProof', 'Justificatif requis'],
              ['refundable', 'Remboursable'],
              ['isActive', 'Active'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} className="rounded border-slate-300" />
                {label}
              </label>
            ))}
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
              <th className="py-3.5 px-4">Libellé</th>
              <th className="py-3.5 px-4">Exigences</th>
              <th className="py-3.5 px-4 text-center">Remb.</th>
              <th className="py-3.5 px-4 text-center">Statut</th>
              {canManage && <th className="py-3.5 px-4" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={canManage ? 6 : 5} className="py-8 text-center text-slate-400">Aucune méthode de paiement configurée.</td></tr>
            )}
            {filtered.map(m => (
              <tr key={m.id} className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3.5 px-4 font-extrabold text-[#2487B8]">{m.methodCode}</td>
                <td className="py-3.5 px-4">
                  <div className="font-bold text-[#16212B]">{m.labelFr}</div>
                  {m.labelAr && <div className="text-[10px] text-slate-400">{m.labelAr}</div>}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex flex-wrap gap-1">
                    <Flag on={m.requiresReference} label="Réf." />
                    <Flag on={m.requiresBank} label="Banque" />
                    <Flag on={m.requiresDate} label="Date" />
                    <Flag on={m.requiresProof} label="Preuve" />
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center text-slate-500">{m.refundable ? 'Oui' : 'Non'}</td>
                <td className="py-3.5 px-4 text-center">
                  <Badge className={`text-[10px] border-none font-bold ${m.isActive ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'}`}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                {canManage && (
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2487B8]">
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
