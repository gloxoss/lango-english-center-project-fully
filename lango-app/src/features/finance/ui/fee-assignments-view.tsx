'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type ClassOption = { id: string; name: string };
type FeeStructureOption = { id: string; name: string; amount: string };
type Assignment = {
  id: string;
  feeStructureId: string;
  feeStructureName: string;
  feeAmount: string;
  classId: string;
  className: string;
  effectiveDate: string;
};

// ponytail: POST/DELETE here are school_admin + finance.approve server-side
// (assigning a whole class's tuition is a bigger call than an accountant
// makes alone) - accountant gets read-only, same shape as pricing-structures.
export function FeeAssignmentsView() {
  const { role } = usePermissions();
  const canManage = role === 'school_admin';

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructureOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ classId: '', feeStructureId: '', effectiveDate: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/finance/fee-assignments')
      .then(res => (res.ok ? res.json() : null))
      .then(json => json?.success && setAssignments(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch('/api/academics/classes?pageSize=100')
      .then(res => (res.ok ? res.json() : null))
      .then(json => json?.success && setClasses(json.data));
    fetch('/api/finance/fee-structures?pageSize=200')
      .then(res => (res.ok ? res.json() : null))
      .then(json => json?.success && setFeeStructures(json.data));
  }, []);

  const handleCreate = async () => {
    if (!form.classId || !form.feeStructureId) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/fee-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || 'Échec de l\'assignation.');
        return;
      }
      setShowForm(false);
      setForm({ classId: '', feeStructureId: '', effectiveDate: new Date().toISOString().slice(0, 10) });
      load();
    } catch {
      setError('Connexion impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/finance/fee-assignments?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Assignations tarifaires</h1>
          <p className="text-xs text-slate-500 mt-1">Quelle structure tarifaire s&apos;applique à quelle classe.</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowForm(v => !v)} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Assigner une structure
          </Button>
        )}
      </div>

      {canManage && showForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Classe</label>
              <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="">Sélectionner...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Structure tarifaire</label>
              <select value={form.feeStructureId} onChange={e => setForm({ ...form, feeStructureId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="">Sélectionner...</option>
                {feeStructures.map(fs => <option key={fs.id} value={fs.id}>{fs.name} ({Number(fs.amount).toLocaleString('fr-FR')} MAD)</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Date d&apos;effet</label>
              <input type="date" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={handleCreate} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              {saving ? 'Enregistrement...' : 'Assigner'}
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
              <th className="py-3.5 px-4">Classe</th>
              <th className="py-3.5 px-4">Structure tarifaire</th>
              <th className="py-3.5 px-4 text-right">Montant</th>
              <th className="py-3.5 px-4">Date d&apos;effet</th>
              {canManage && <th className="py-3.5 px-4" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && assignments.length === 0 && (
              <tr><td colSpan={canManage ? 5 : 4} className="py-8 text-center text-slate-400">Aucune assignation configurée.</td></tr>
            )}
            {assignments.map(a => (
              <tr key={a.id} className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3.5 px-4 font-bold text-[#16212B]">{a.className}</td>
                <td className="py-3.5 px-4 text-slate-600">{a.feeStructureName}</td>
                <td className="py-3.5 px-4 text-right font-extrabold text-[#16212B]">{Number(a.feeAmount).toLocaleString('fr-FR')} MAD</td>
                <td className="py-3.5 px-4 text-slate-500">{a.effectiveDate}</td>
                {canManage && (
                  <td className="py-3.5 px-4 text-right">
                    <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
