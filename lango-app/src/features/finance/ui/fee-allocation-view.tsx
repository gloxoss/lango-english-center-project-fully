'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type ClassOption = { id: string; name: string };
type AllocationStudent = {
  studentId: string;
  studentName: string;
  baseAmount: number;
  discountAmount: number;
  netAmount: number;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  paid: 'Facturé (payé)',
  partial: 'Facturé (partiel)',
  pending: 'Facturé (en attente)',
  not_invoiced: 'Non facturé',
};

export function FeeAllocationView({ locale: _locale }: { locale?: string } = {}) {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState('');
  const [feeStructureName, setFeeStructureName] = useState<string | null>(null);
  const [students, setStudents] = useState<AllocationStudent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/academics/classes?pageSize=100')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setClasses(json.data);
          if (json.data[0]) {
            setClassId(json.data[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!classId) {
      return;
    }
    setLoading(true);
    fetch(`/api/finance/fee-allocation?classId=${classId}`)
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setFeeStructureName(json.data.feeStructure?.name ?? null);
          setStudents(json.data.students);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [classId]);

  const filtered = students.filter(a => a.studentName.toLowerCase().includes(search.toLowerCase()));
  const totalNet = filtered.reduce((sum, s) => sum + s.netAmount, 0);
  const totalDiscount = filtered.reduce((sum, s) => sum + s.discountAmount, 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Affectation des frais par classe</h1>
        <p className="text-xs text-slate-500 mt-1">
          {feeStructureName ? `Structure tarifaire assignée : ${feeStructureName}` : 'Aucune structure tarifaire assignée à cette classe.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-400">Élèves dans la classe</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{filtered.length}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-blue-200/60 bg-blue-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#1B6C93]">Net total (réel)</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{totalNet.toLocaleString('fr-FR')} MAD</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-emerald-200/60 bg-emerald-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#17A673]">Réductions appliquées (réel)</p>
          <p className="text-2xl font-extrabold text-[#17A673]">{totalDiscount.toLocaleString('fr-FR')} MAD</p>
        </Card>
      </div>

      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Classe :</span>
          <select
            value={classId}
            onChange={e => setClassId(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-extrabold bg-white text-[#16212B]"
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher élève..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
          />
        </div>
      </Card>

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Élève</th>
                <th className="py-3.5 px-4">Montant</th>
                <th className="py-3.5 px-4">Réduction</th>
                <th className="py-3.5 px-4">Net</th>
                <th className="py-3.5 px-4 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Chargement...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Aucune structure tarifaire assignée, ou aucun élève.</td></tr>
              )}
              {filtered.map(item => (
                <tr key={item.studentId} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-[#16212B]">{item.studentName}</td>
                  <td className="py-3.5 px-4 text-slate-500">{item.baseAmount.toLocaleString('fr-FR')} MAD</td>
                  <td className="py-3.5 px-4 font-bold text-[#17A673]">{item.discountAmount > 0 ? `-${item.discountAmount.toLocaleString('fr-FR')} MAD` : '—'}</td>
                  <td className="py-3.5 px-4 font-extrabold text-[#16212B]">{item.netAmount.toLocaleString('fr-FR')} MAD</td>
                  <td className="py-3.5 px-4 text-right">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${item.status === 'not_invoiced' ? 'bg-slate-100 text-slate-600' : 'bg-[#DDF5EC] text-[#17A673]'}`}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
